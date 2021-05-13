// import { Client } from "@notionhq/client";
const { Client } = require("@notionhq/client");
let notion: typeof Client;

const engine: Engine = {
  id: "notion",
  init: ({ token }: { token: string }) => {
    notion = new Client({ auth: token });
  },
  name: "Notion",
  search: async (q) => {
    if (!notion) {
      throw Error("Engine not initialized");
    }

    console.log("searching..");
    const response = await notion.search({
      query: q,
      sort: {
        direction: "ascending",
        timestamp: "last_edited_time",
      },
    });

    console.log("notion response is... ", notion);
    return response.results.map(() => ({
      modified: new Date().getTime(),
      snippet: "klsdjfdsf",
      title: "dsfdsfd",
      url: `https:dsfdsfds`,
    }));
    // return data.matches
    //   .map((m) => m.metadata.metadata)
    //   .filter((metadata) => !excludeRegex?.test(metadata.path_display))
    //   .map((metadata) => ({
    //     modified: getUnixTime(metadata.server_modified),
    //     snippet: `${metadata[".tag"].charAt(0).toUpperCase()}${metadata[
    //       ".tag"
    //     ].slice(1)} in ${metadata.path_display
    //       .slice(1)
    //       .replace(/\/[^/]+$/, "")}`,
    //     title: metadata.name,
    //     url: `https://www.dropbox.com/home${metadata.path_display}`,
    //   }));

    // return {
    //   modified: "test",
    // };
  },
};

export default engine;
