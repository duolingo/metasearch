import axios, { AxiosInstance } from "axios";

import { escapeQuotes } from "./index";

let client: AxiosInstance | undefined;

const normalize = (wikiMarkup: string) =>
  wikiMarkup
    .replace(
      /&(amp|gt|lt|nbsp|quot);/g,
      ({}, entity) =>
        ({
          amp: "&",
          gt: ">",
          lt: "<",
          nbsp: " ",
          quot: '"',
        }[entity]),
    )
    .replace(/&#(\d+);/gi, ({}, n) => String.fromCharCode(parseInt(n, 10)))
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
  search: async q => {
    if (!client) {
      throw Error("Engine not initialized");
    }

    // https://developer.atlassian.com/cloud/confluence/rest/#api-group-Search
    const data: {
      _links: { base: string };
      results: {
        content: {
          status: "current" | "draft" | "historical" | "trashed";
          type: "blogpost" | "page";
        };
        excerpt: string;
        title: string;
        url: string;
      }[];
    } = (
      await client.get("/search", {
        params: {
          cql: `(type = page) AND (text ~ "${escapeQuotes(
            q,
          )}") OR (title ~ "${escapeQuotes(q)}")`,
        },
      })
    ).data;
    return data.results
      .filter(r => r.content.status === "current" && r.content.type === "page")
      .map(r => ({
        snippet: normalize(r.excerpt),
        title: normalize(r.title),
        url: `${data._links.base}${r.url}`,
      }));
  },
};

export default engine;
