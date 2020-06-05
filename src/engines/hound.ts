import axios, { AxiosInstance } from "axios";

import { Engine, Result } from "./index";

let client: AxiosInstance | undefined;

const engine: Engine = {
  id: "hound",
  init: ({ origin }: { origin: string }) => {
    client = axios.create({ baseURL: `${origin}/api/v1` });
  },
  search: async q => {
    if (!client) {
      throw Error("Client not initialized");
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
            url: `https://github.com/duolingo/${repo}/blob/master/${Filename}#L${LineNumber}`,
          })),
        ),
      )
      .flat(3) as Result[];
  },
};

export default engine;
