import axios, { AxiosInstance } from "axios";

import { Engine, escapeQuotes } from "./index";

let client: AxiosInstance | undefined;
let origin: string | undefined;

const engine: Engine = {
  id: "jira",
  init: (options: { origin: string; token: string; user: string }) => {
    client = axios.create({
      auth: { password: options.token, username: options.user },
      baseURL: `${options.origin}/rest/api/2`,
    });
    origin = options.origin;
  },
  search: async q => {
    if (!(client && origin)) {
      throw Error("Client not initialized");
    }

    const data: {
      issues: {
        fields: { description: string; summary: string };
        key: string;
      }[];
    } = (
      await client.get("/search", {
        params: { jql: `text ~ "${escapeQuotes(q)}"` },
      })
    ).data;
    return data.issues.map(issue => ({
      snippet: issue.fields.description,
      title: `${issue.key}: ${issue.fields.summary}`,
      url: `${origin}/browse/${issue.key}`,
    }));
  },
};

export default engine;
