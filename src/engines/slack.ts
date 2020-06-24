import axios, { AxiosInstance, AxiosResponse } from "axios";

import { rateLimit } from "./index";

interface Channel {
  id: string;
  is_archived: boolean;
  name: string;
  purpose: { value: string };
  topic: { value: string };
}

let client: AxiosInstance | undefined;
let getChannels: (() => Promise<Set<Channel>>) | undefined;
let subdomain: string | undefined;

const engine: Engine = {
  id: "slack",
  init: ({ organization, token }: { organization: string; token: string }) => {
    const axiosClient = axios.create({
      baseURL: "https://slack.com/api",
      headers: { Authorization: `Bearer ${token}` },
    });
    client = axiosClient;

    getChannels = rateLimit(async () => {
      // https://api.slack.com/methods/conversations.list
      const data: {
        channels: Channel[];
      } = (
        await axiosClient.get("/conversations.list", {
          params: { limit: 1000 },
        })
      ).data;
      return new Set(data.channels);
    }, 4);

    subdomain = organization;
  },
  name: "Slack",
  search: async q => {
    if (!(client && getChannels)) {
      throw Error("Engine not initialized");
    }

    return (
      await Promise.all([
        // Channels
        (async () => {
          const channels = Array.from(await getChannels()).sort((a, b) =>
            a.name > b.name ? 1 : -1,
          );
          const normalize = (s: string) => s.replace(/\W/g, "").toLowerCase();
          return ([c => c.name, c => c.purpose.value, c => c.topic.value] as ((
            c: Channel,
          ) => string)[]).flatMap(fn =>
            channels
              .filter(
                c => !c.is_archived && normalize(fn(c)).includes(normalize(q)),
              )
              .map(({ id, name, purpose, topic }) => ({
                snippet: purpose.value.length ? purpose.value : topic.value,
                title: `#${name}`,
                url: `https://${subdomain}.slack.com/archives/${id}`,
              })),
          );
        })(),

        // Messages
        (async () => {
          /**
           * This limit could probably be further increased without triggering
           * Slack's rate limiting, but it's hard to imagine a real user
           * needing to see more than this many results during regular use...
           */
          const MAX_RESULTS = 1000;
          /** Maximum value allowed by Slack */
          const PAGE_SIZE = 100;

          // https://api.slack.com/methods/search.messages
          const getPage = (
            zeroIndexedPage: number,
          ): Promise<AxiosResponse<{
            messages: {
              matches: {
                channel: { name: string };
                permalink: string;
                text: string;
                username: string;
              }[];
              paging: { pages: number };
            };
          }>> =>
            client!.get("/search.messages", {
              params: { count: PAGE_SIZE, page: zeroIndexedPage + 1, query: q },
            });

          const firstPageResponse = await getPage(0);
          const numPages = firstPageResponse.data.messages.paging.pages;
          const pageResponses = await Promise.all(
            Array(Math.ceil(Math.min(numPages, MAX_RESULTS / PAGE_SIZE)) - 1)
              .fill(0)
              .map(({}, i) => getPage(i + 1)),
          );
          pageResponses.unshift(firstPageResponse);

          return pageResponses
            .flatMap(r => r.data.messages.matches)
            .filter(m => m.channel.name !== "USLACKBOT")
            .map(m => ({
              snippet: m.text,
              title: `Post by @${m.username} in #${m.channel.name}`,
              url: m.permalink,
            }));
        })(),
      ])
    ).flat();
  },
};

export default engine;
