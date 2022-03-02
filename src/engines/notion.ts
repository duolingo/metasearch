import axios, { AxiosInstance } from "axios";

import { getUnixTime } from "../util";

let axiosClient: AxiosInstance | undefined;
let notionWorkspace: string;

type RichText = {
  plain_text: string;
} & {
  [propertyName: string]: string;
};
interface Page {
  object: "page";
  id: string;
  last_edited_time: string;
  properties: {
    Name?: {
      type: "title";
      title: RichText[];
    };
    title?: {
      type: "title";
      title: RichText[];
    };
  } & { [propertyName: string]: string };
}

const engine: Engine = {
  id: "notion",
  init: ({ token, workspace }: { token: string; workspace: string }) => {
    token = token;
    notionWorkspace = workspace;
    axiosClient = axios.create({
      baseURL: "https://api.notion.com/v1",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "Notion-Version": "2021-05-13",
      },
    });
  },
  name: "Notion",
  search: async (q) => {
    if (!axiosClient) {
      throw Error("Engine not initialized");
    }

    return (
      await axiosClient.post("/search", {
        query: q,
        sort: {
          direction: "ascending",
          timestamp: "last_edited_time",
        },
        filter: {
          value: "page",
          property: "object",
        },
      })
    ).data.results
      .map((result: Page) => {
        const title = result.properties.Name
          ? result.properties.Name.title[0]
          : result.properties.title && result.properties.title.title[0];
        if (title) {
          return {
            modified: getUnixTime(result.last_edited_time),
            title: title.plain_text,
            url: `notion://notion.so/${notionWorkspace}/${formatTitle(
              title.plain_text
            )}-${formatId(result.id)}`,
          };
        }
      })
      .filter((p: Page | undefined) => p !== undefined);
  },
};

const formatTitle = (title: string) => title.replace(/\W+/g, "-");
const formatId = (id: string) => id.replace(/-/g, "");

export default engine;
