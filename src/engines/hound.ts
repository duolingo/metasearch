import axios, { AxiosInstance } from "axios";
import * as he from "he";

let client: AxiosInstance | undefined;
let org: string | undefined;
let host: string;

let displayName: string;

const engine: Engine = {
  id: "hound",
  init: ({
    name,
    codeHost,
    organization,
    origin,
  }: {
    name: string | undefined;
    codeHost: string | undefined;
    organization: string | undefined;
    origin: string;
  }) => {
    client = axios.create({ baseURL: `${origin}/api/v1` });
    org = organization;
    displayName = name ? name : "hound";
    host = codeHost ? codeHost : "https://github.com"
  },
  name: () => displayName,
  search: async q => {
    if (!(client && host)) {
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
    } = (
      await client.get("/search", {
        params: {
          i: 1,
          q: `${q}|${q.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&")}`,
          repos: "*",
        },
      })
    ).data;
    return Object.entries(data.Results || {})
      .map(([repo, result]) =>
        result.Matches.map(({ Filename, Matches }) =>
          Matches.map(({ Line, LineNumber }) => ({
            snippet:
              Line.length > 1000
                ? "(Line too long to display)"
                : `<code>${he.encode(Line)}</code>`,
            title: `${repo}/${Filename}#L${LineNumber}`,
            url: `${host}/${org}/${repo}/blob/master/${Filename}#L${LineNumber}`,
          })),
        ),
      )
      .flat(3) as Result[];
  },
};

export default engine;
