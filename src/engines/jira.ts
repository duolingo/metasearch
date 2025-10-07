import axios, { AxiosInstance } from "axios";

import { escapeQuotes, getUnixTime, trimLines } from "../util";

let client: AxiosInstance | undefined;
let origin: string | undefined;

// https://confluence.atlassian.com/jiracoreserver073/search-syntax-for-text-fields-861257223.html#Searchsyntaxfortextfields-escapingSpecialcharacters
const sanitize = (s: string) =>
  escapeQuotes(s.replace(/[+&|!(){}[\]^~*?\\:]/g, ""))
    .replace(/\s+/, " ")
    .trim();

const engine: Engine = {
  id: "jira",
  init: (options: { origin: string; token: string; user: string }) => {
    client = axios.create({
      auth: { password: options.token, username: options.user },
      baseURL: `${options.origin}/rest/api/3`,
    });
    origin = options.origin;
  },
  isSnippetLarge: true,
  name: "Jira",
  search: async q => {
    if (!(client && origin)) {
      throw Error("Engine not initialized");
    }

    // https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issue-search/#api-rest-api-3-search-jql-get
    const data: {
      issues: {
        fields: {
          summary: string;
          /** e.g. "2017-11-20T11:50:25.653-0500" */
          updated: string;
        };
        key: string;
        renderedFields: { description: string };
      }[];
    } = (
      await client.get("/search/jql", {
        params: {
          expand: "renderedFields",
          fields: "description,summary,updated",
          jql: `text ~ "${sanitize(q)}"`,
        },
      })
    ).data;
    return data.issues.map(issue => ({
      modified: getUnixTime(issue.fields.updated),
      snippet: trimLines(issue.renderedFields.description, q),
      title: `${issue.key}: ${issue.fields.summary}`,
      url: `${origin}/browse/${issue.key}`,
    }));
  },
};

export default engine;
