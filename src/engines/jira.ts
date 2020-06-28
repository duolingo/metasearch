import axios, { AxiosInstance } from "axios";

import { escapeQuotes } from "../util";

let client: AxiosInstance | undefined;
let origin: string | undefined;

// https://confluence.atlassian.com/jiracoreserver073/search-syntax-for-text-fields-861257223.html#Searchsyntaxfortextfields-escapingSpecialcharacters
const sanitize = (s: string) =>
  escapeQuotes(s.replace(/[+\-&|!(){}[\]^~*?\\:]/g, ""))
    .replace(/\s+/, " ")
    .trim();

const engine: Engine = {
  id: "jira",
  init: (options: { origin: string; token: string; user: string }) => {
    client = axios.create({
      auth: { password: options.token, username: options.user },
      baseURL: `${options.origin}/rest/api/2`,
    });
    origin = options.origin;
  },
  isSnippetLarge: true,
  name: "Jira",
  search: async q => {
    if (!(client && origin)) {
      throw Error("Engine not initialized");
    }

    // TODO: Use API v3?
    // https://developer.atlassian.com/server/jira/platform/jira-rest-api-examples/#searching-for-issues-examples
    const data: {
      issues: {
        fields: { summary: string };
        key: string;
        renderedFields: { description: string };
      }[];
    } = (
      await client.get("/search", {
        params: { expand: "renderedFields", jql: `text ~ "${sanitize(q)}"` },
      })
    ).data;
    return data.issues.map(issue => ({
      snippet: issue.renderedFields.description,
      title: `${issue.key}: ${issue.fields.summary}`,
      url: `${origin}/browse/${issue.key}`,
    }));
  },
};

export default engine;
