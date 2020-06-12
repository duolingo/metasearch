import axios, { AxiosInstance } from "axios";

let client: AxiosInstance | undefined;
let orgId: string | undefined;

const engine: Engine = {
  id: "figma",
  init: ({ organization, token }: { organization: number; token: string }) => {
    client = axios.create({
      baseURL: "https://www.figma.com/api",
      headers: { Cookie: `figma.st=${token}` },
    });
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
          if (!client) {
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
            await client.get(`/search/${apiName}`, {
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
