import axios, { AxiosInstance } from "axios";

let client: AxiosInstance | undefined;
let org: string | undefined;

const engine: Engine = {
  id: "hound",
  init: ({
    organization,
    origin,
  }: {
    organization: string;
    origin: string;
  }) => {
    client = axios.create({ baseURL: `${origin}/api/v1` });
    org = organization;
  },
  name: "Hound",
  search: async q => {
    if (!(client && org)) {
      throw Error("Engine not initialized");
    }

    const data: {
      Results?: Record<
        string,
        {
          Matches: {
            Filename: string;
            Matches: {
              Line: string;
              LineNumber: string;
            }[];
          }[];
        }
      >;
    } = (await client.get("/search", { params: { q, repos: "*" } })).data;
    return Object.entries(data.Results || {})
      .map(([repo, result]) =>
        result.Matches.map(({ Filename, Matches }) =>
          Matches.map(({ Line, LineNumber }) => ({
            snippet: Line,
            title: `${repo}/${Filename}#L${LineNumber}`,
            url: `https://github.com/${org}/${repo}/blob/master/${Filename}#L${LineNumber}`,
          })),
        ),
      )
      .flat(3) as Result[];
  },
};

export default engine;
