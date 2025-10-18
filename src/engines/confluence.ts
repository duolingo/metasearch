import axios, { AxiosInstance } from "axios";
import * as he from "he";

import { escapeQuotes, getUnixTime } from "../util";

let client: AxiosInstance | undefined;

const normalize = (wikiMarkup: string) =>
  he
    .decode(wikiMarkup)
    .replace(/@@@(end)?hl@@@/g, "")
    .replace(/\s+/g, " ");

type DocumentType = "blogpost" | "page" | "comment" | "attachment";

let documentTypes: DocumentType[];

const engine: Engine = {
  id: "confluence",
  init: (options: { origin: string; token: string; user: string, documentTypes: DocumentType[]|undefined}) => {
    client = axios.create({
      auth: { password: options.token, username: options.user },
      baseURL: `${options.origin}/wiki/rest/api`,
    });
    documentTypes = options.documentTypes ? options.documentTypes : ["page"];
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
          type: DocumentType;
        };
        excerpt: string;
        /** e.g. "2020-06-30T19:04:37.644Z" */
        lastModified: string;
        title: string;
        resultGlobalContainer: {
          title: string;
        };
        url: string;
      }[];
    } = (
      await client.get("/search", {
        params: {
          cql: `(type in (${documentTypes.join(',')})) AND (text ~ "${escapeQuotes(
            q,
          )}") OR (title ~ "${escapeQuotes(q)}")`,
          limit: 1000,
        },
      })
    ).data;

    return data.results
      .filter(
        r => r.content?.status === "current",
      )
      .map(r => ({
        modified: getUnixTime(r.lastModified),
        snippet: normalize(r.excerpt),
        title: `${r.resultGlobalContainer ? '[' + r.resultGlobalContainer.title + '] ' : ''}${normalize(r.title)}`,
        url: `${data._links.base}${r.url}`,
      }));
  },
};

export default engine;
