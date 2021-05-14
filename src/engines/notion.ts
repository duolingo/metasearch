
import axios, { AxiosInstance } from "axios";
import { getUnixTime } from "../util";

let axiosClient: AxiosInstance | undefined;
let notionWorkspace: string;

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

    console.log("query for ", q)

    const response = (
      await axiosClient.post("/search",{}, {
        data: {
          query: q,
          sort: {
            direction: "ascending",
            timestamp: "last_edited_time",
          },
          filter: {
            object: 'page'
          }
        },
      })
    ).data;

    console.log("notion response is... ", response);
    const values = response.results.map((result: any) => {
      const type: 'database' | 'page' = result.object;
      const title  = result?.properties?.Name?.title[0]?.plain_text;
      if (result.object === 'page' && title) {
        console.log("title is", title)
        return {
          modified: getUnixTime(result.last_edited_time),
          snippet: result.object,
          title: title,
          url:
            type === "page"
              ? `notion://notion.so/${notionWorkspace}/${formatTitle(
                  title
                )}-${formatId(result.id)}`
              : "",
        };
      }
    }).filter((o: any) => (o !== undefined));
    return values
  },
};

const formatTitle = (title: string) => (title.replace(/\W+/g, '-'))
const formatId = (id: string) => (id.replace(/-/g, ""))

export default engine;
