import axios, { AxiosInstance } from "axios";
import * as marked from "marked";

import { getUnixTime, trimLines } from "../util";

let client: AxiosInstance | undefined;

const engine: Engine = {
  id: "gitlab",
  init: ({
    origin = "https://gitlab.com",
    token,
  }: {
    origin: string;
    token: string;
  }) => {
    const axiosClient = axios.create({
      baseURL: `${origin}/api/v4`,
      headers: { Authorization: `bearer ${token}` },
    });
    client = axiosClient;
  },
  name: "GitLab",
  search: async q => {
    if (!(client)) {
      throw Error("Engine not initialized");
    }

    // https://docs.gitlab.com/ee/api/merge_requests.html#list-merge-requests
    const data: {
      title: string,
      description: string,
      web_url: string,
      updated_at: string
    }[] = (
      await client.get("/merge_requests", {
        params: {
          search: q,
          scope: 'all'
        }
      })
    ).data;

    return data
      .map(mr => ({
        modified: getUnixTime(mr.updated_at),
        snippet: `<blockquote>${marked(trimLines(mr.description, q))}</blockquote>`,
        title: mr.title,
        url: mr.web_url,
      }));
  },
};

export default engine;
