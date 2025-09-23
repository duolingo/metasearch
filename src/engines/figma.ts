import axios, { AxiosError, AxiosInstance } from "axios";

import { getUnixTime, rateLimit } from "../util";

let getClient: (() => Promise<AxiosInstance | undefined>) | undefined;
let orgId: string | undefined;

const engine: Engine = {
  id: "figma",
  init: ({
    organization,
    password,
    user,
  }: {
    organization: number;
    password: string;
    user: string;
  }) => {
    getClient = rateLimit(async () => {
      // Log into Figma using their web browser flow. Their session token seems
      // to expire after 1-3 days in my testing.
      try {
        const tokenResponse = await axios.post(
          "https://www.figma.com/api/session/login",
          { email: user, password, username: user },
          { headers: { "Content-Type": "application/json" } },
        );
        const token = (tokenResponse.headers["set-cookie"] as string[])
          .find(c => /^figma\.st=[^;]/.test(c))
          ?.split(/[=;]/)[1];
        if (!token) {
          throw Error("Figma login failed");
        }

        return axios.create({
          baseURL: "https://www.figma.com",
          headers: { Cookie: `figma.st=${token}` },
        });
      } catch (ex) {
        console.error(ex);
        return undefined;
      }
    }, 24);

    orgId = `${organization}`;
  },
  name: "Figma",
  search: async q => {
    interface Model<M> {
      getResult: (el: M) => Result | Promise<Result>;
      urlFragment: string;
    }

    interface File {
      creator: { handle: string };
      name: string;
      thumbnail_url: string;
      /** e.g. "2020-06-30T14:05:30.746Z" */
      updated_at: string;
      url: string;
    }

    // Get API client
    if (!getClient) {
      throw Error("Engine not initialized");
    }
    const client = await getClient();
    if (!client) {
      return [];
    }

    /** Generates a string of HTML for displaying a linked thumbnail */
    const getThumbnail = async (f: File) => {
      try {
        await client.get(f.thumbnail_url, { maxRedirects: 0 });
        throw Error("Thumbnail URL not found");
      } catch (ex: any) {
        // TODO: Use library-provided type guard in v0.20
        // https://github.com/axios/axios/pull/2949
        if (
          ((e): e is AxiosError => e.isAxiosError)(ex) &&
          ex.response?.status === 302
        ) {
          const src = ex.response?.headers["location"] as string;
          return `<a href="${f.url}"><img src="${src}"></a>`;
        }
        throw ex;
      }
    };

    const MODEL_TYPES: Model<unknown>[] = [
      {
        getResult: async ({ model }: { model: File }) => ({
          modified: getUnixTime(model.updated_at),
          snippet: `File created by ${
            model.creator.handle
          }<br>${await getThumbnail(model)}`,
          title: model.name,
          url: model.url,
        }),
        urlFragment: "fig_files",
      },
      {
        getResult: async ({
          file_count,
          files_last_touched_at,
          model,
          recent_files,
        }: {
          file_count: number;
          /** e.g. "2020-06-30T14:05:30.746Z" */
          files_last_touched_at: string;
          model: { id: string; name: string };
          recent_files: File[];
        }) => ({
          modified: getUnixTime(files_last_touched_at),
          snippet: `Project containing ${
            file_count === 1 ? "1 file" : `${file_count} files`
          }<br>${(
            await Promise.all(
              recent_files.slice(0, 3).map(f => getThumbnail(f)),
            )
          ).join("")}`,
          title: model.name,
          url: `https://www.figma.com/files/${orgId}/project/${model.id}`,
        }),
        urlFragment: "folders",
      },
      {
        getResult: ({
          files_last_touched_at,
          member_count,
          model,
        }: {
          /** e.g. "2020-06-30T14:05:30.746Z" */
          files_last_touched_at: string;
          member_count: number;
          model: { id: string; name: string };
        }) => ({
          modified: getUnixTime(files_last_touched_at),
          snippet: `Team with ${
            member_count === 1 ? "1 member" : `${member_count} members`
          }`,
          title: model.name,
          url: `https://www.figma.com/files/${orgId}/team/${model.id}`,
        }),
        urlFragment: "teams",
      },
    ];

    return (
      await Promise.all(
        MODEL_TYPES.map(async ({ getResult, urlFragment }) => {
          const data: {
            meta: { results: Parameters<typeof getResult>[0][] };
          } = (
            await client.get(`/api/search/${urlFragment}`, {
              params: {
                desc: false,
                org_id: orgId,
                query: q,
                sort: "relevancy",
              },
            })
          ).data;
          return Promise.all(data.meta.results.map(el => getResult(el)));
        }),
      )
    ).flat();
  },
};

export default engine;
