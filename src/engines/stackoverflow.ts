import axios, { AxiosInstance } from "axios";
import * as he from "he";

let client: AxiosInstance | undefined;
let params: object | undefined;

const engine: Engine = {
  id: "stackoverflow",
  init: ({ team, token }: { team: string; token: string }) => {
    // https://stackoverflow.help/en/articles/4385859-stack-overflow-for-teams-api
    client = axios.create({
      baseURL: "https://api.stackoverflowteams.com/2.3",
      headers: { "X-API-Access-Token": token },
    });
    params = { team };
  },
  name: "Stack Overflow",
  search: async q => {
    if (!(client && params)) {
      throw Error("Engine not initialized");
    }

    const data: {
      items: {
        answer_count: number;
        /** e.g. 1662755732 */
        last_activity_date: number;
        link: string;
        score: number;
        tags: string[];
        title: string;
      }[];
    } = (await client.get("/search/advanced", { params: { ...params, q } }))
      .data;
    return data.items.map(item => ({
      modified: item.last_activity_date,
      snippet: `${item.score} ${item.score === 1 ? "upvote" : "upvotes"}, ${
        item.answer_count
      } ${item.answer_count === 1 ? "answer" : "answers"}${
        item.tags.length ? `. Tags: ${item.tags.sort().join(", ")}` : ""
      }`,
      title: he.decode(item.title),
      url: item.link,
    }));
  },
};

export default engine;
