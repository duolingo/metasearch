import axios, { AxiosInstance } from "axios";
import * as he from "he";

import { escapeQuotes, getUnixTime } from "../util";

let client: AxiosInstance | undefined;

const normalize = (wikiMarkup: string) =>
  he
    .decode(wikiMarkup)
    .replace(/@@@(end)?hl@@@/g, "")
    .replace(/\s+/g, " ");

const engine: Engine = {
  id: "confluence",
  init: (options: { origin: string; token: string; user: string }) => {
    client = axios.create({
      auth: { password: options.token, username: options.user },
      baseURL: `${options.origin}/wiki/rest/api`,
    });
  },
  name: "Confluence",
  search: async q => {
    if (!client) {
      throw Error("Engine not initialized");
    }

    // https://developer.atlassian.com/cloud/confluence/rest/#api-group-Search
    const data: {
      _links: { base: string };
      results: {
        content?: {
          status: "current" | "draft" | "historical" | "trashed";
          type: "blogpost" | "page";
        };
        excerpt: string;
        /** e.g. "2020-06-30T19:04:37.644Z" */
        lastModified: string;
        title: string;
        url: string;
      }[];
    } = (
      await client.get("/search", {
        params: {
          cql: `(type = page) AND (text ~ "${escapeQuotes(
            q,
          )}") OR (title ~ "${escapeQuotes(q)}")`,
          limit: 1000,
        },
      })
    ).data;
    return data.results
      .filter(
        r => r.content?.status === "current" && r.content?.type === "page",
      )
      .map(r => ({
        modified: getUnixTime(r.lastModified),
        snippet: normalize(r.excerpt),
        title: normalize(r.title),
        url: `${data._links.base}${r.url}`,
      }));
  },
};

export default engine;
