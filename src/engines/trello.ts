import axios, { AxiosInstance } from "axios";

interface SearchResults {
  boards: [
    {
      name: string;
      shortUrl: string;
    },
  ];
  cards: [
    {
      name: string;
      shortUrl: string;
    },
  ];
  members: [
    {
      fullName: string;
      url: string;
    },
  ];
  organizations: [
    {
      displayName: string;
      url: string;
    },
  ];
}

let axiosClient: AxiosInstance | undefined;
let trelloKey: string;
let trelloToken: string;

const engine: Engine = {
  id: "trello",
  init: ({ key, token }: { key: string; token: string }) => {
    trelloKey = key;
    trelloToken = token;
    axiosClient = axios.create({
      baseURL: "https://api.trello.com/1",
    });
  },
  name: "Trello",
  search: async q => {
    if (!axiosClient) {
      throw Error("Engine not initialized");
    }

    const results: SearchResults = (
      await axiosClient.get("/search", {
        params: {
          key: trelloKey,
          token: trelloToken,
          query: q,
          board_fields: "name,shortUrl",
          card_fields: "name,shortUrl",
          member_fields: "fullName,url",
          organization_fields: "displayName,url",
        },
      })
    ).data;
    return [
      results.boards.map(b => ({
        title: `Board: ${b.name}`,
        url: b.shortUrl,
      })),
      results.cards.map(c => ({
        title: `Card: ${c.name}`,
        url: c.shortUrl,
      })),
      results.members.map(m => ({
        title: `Member: ${m.fullName}`,
        url: m.url,
      })),
      results.organizations.map(o => ({
        title: `Workspace: ${o.displayName}`,
        url: o.url,
      })),
    ].flat();
  },
};

export default engine;
