import axios, { AxiosInstance } from "axios";

import { rateLimit } from "./index";

let getClient: (() => Promise<AxiosInstance>) | undefined;
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
        baseURL: "https://www.figma.com/api",
        headers: { Cookie: `figma.st=${token}` },
      });
    }, 24);

    orgId = `${organization}`;
  },
  name: "Figma",
  search: async q => {
    /** Array of [human-readable model name, API route path] tuples */
    const MODEL_TYPES: [string, string][] = [
      ["File", "fig_files"],
      ["Project", "folders"],
      ["Team", "teams"],
    ];

    return (
      await Promise.all(
        MODEL_TYPES.map(async ([modelName, apiName]) => {
          if (!getClient) {
            throw Error("Engine not initialized");
          }

          const data: {
            meta: {
              results: {
                model: {
                  id?: string;
                  name: string;
                  team_id?: string;
                  url?: string;
                };
              }[];
            };
          } = (
            await (await getClient()).get(`/search/${apiName}`, {
              params: {
                desc: false,
                org_id: orgId,
                query: q,
                sort: "relevancy",
              },
            })
          ).data;
          return data.meta.results.map(({ model }) => ({
            snippet: modelName,
            title: model.name,
            url:
              model.url ??
              `https://www.figma.com/files/${orgId}/${
                model.team_id ? "project" : "team"
              }/${model.id}`,
          }));
        }),
      )
    ).flat();
  },
};

export default engine;
