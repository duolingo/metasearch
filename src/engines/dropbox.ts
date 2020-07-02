import axios, { AxiosInstance } from "axios";

import { getUnixTime } from "../util";

let client: AxiosInstance | undefined;
let excludeRegex: RegExp | undefined;
let searchPath: string | undefined;

const engine: Engine = {
  id: "dropbox",
  init: ({
    exclude,
    folder,
    token,
  }: {
    exclude?: string;
    folder?: string;
    token: string;
  }) => {
    client = axios.create({
      baseURL: "https://api.dropboxapi.com/2",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (exclude) {
      excludeRegex = new RegExp(exclude, "i");
    }
    if (folder) {
      searchPath = `/${folder}`;
    }
  },
  name: "Dropbox",
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
            /** e.g. "2019-08-19T17:07:41Z" */
            server_modified: string;
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

    return data.matches
      .map(m => m.metadata.metadata)
      .filter(metadata => !excludeRegex?.test(metadata.path_display))
      .map(metadata => ({
        modified: getUnixTime(metadata.server_modified),
        snippet: `${metadata[".tag"].charAt(0).toUpperCase()}${metadata[
          ".tag"
        ].slice(1)} in ${metadata.path_display
          .slice(1)
          .replace(/\/[^/]+$/, "")}`,
        title: metadata.name,
        url: `https://www.dropbox.com/home${metadata.path_display}`,
      }));
  },
};

export default engine;
