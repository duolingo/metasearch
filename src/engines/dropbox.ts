import axios, { AxiosInstance } from "axios";

import { Engine } from "./index";

let client: AxiosInstance | undefined;
let searchPath: string | undefined;

const engine: Engine = {
  id: "dropbox",
  init: ({ folder, token }: { folder?: string; token: string }) => {
    client = axios.create({
      baseURL: "https://api.dropboxapi.com/2",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (folder) {
      searchPath = `/${folder}`;
    }
  },
  search: async q => {
    if (!client) {
      throw Error("Engine not initialized");
    }

    // https://www.dropbox.com/developers/documentation/http/documentation#files-search
    const data: {
      has_more: boolean;
      matches: {
        metadata: {
          metadata: {
            ".tag": "folder";
            name: string;
            path_display: string;
          };
        };
      }[];
    } = (
      await client.post("/files/search_v2", {
        include_highlights: false,
        options: { max_results: 1000, path: searchPath },
        query: q,
      })
    ).data;

    return data.matches.map(({ metadata: { metadata } }) => ({
      snippet: metadata[".tag"],
      title: metadata.name,
      url: `https://www.dropbox.com/home${metadata.path_display}`,
    }));
  },
};

export default engine;
