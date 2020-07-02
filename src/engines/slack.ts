import axios, { AxiosInstance, AxiosResponse } from "axios";

import { fuzzyIncludes, rateLimit } from "../util";

interface Channel {
  id: string;
  is_archived: boolean;
  name: string;
  purpose: { value: string };
  topic: { value: string };
}

let includeBotMessages = false;
let client: AxiosInstance | undefined;
let getChannels: (() => Promise<Set<Channel>>) | undefined;
let subdomain: string | undefined;

const engine: Engine = {
  id: "slack",
  init: ({
    bots,
    organization,
    token,
  }: {
    bots: boolean;
    organization: string;
    token: string;
  }) => {
    includeBotMessages = bots;

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
    const axiosClient = client;
    if (!(axiosClient && getChannels)) {
      throw Error("Engine not initialized");
    }

    // TODO: Also expand username mentions such as <@U8DL4L6VC> instead of
    // letting them get stripped out by sanitize-html
    const linkify = (s: string) =>
      s
        .replace(/<(https?:\/\/[^|>]+)>/g, '<a href="$1">$1</a>')
        .replace(
          /<((?:https?|mailto):[^|]+)\|([^>]+)>/g,
          '<a href="$1">$2</a>',
        );

    return (
      await Promise.all([
        // Channels
        (async () => {
          const channels = Array.from(await getChannels()).sort((a, b) =>
            a.name > b.name ? 1 : -1,
          );
          return ([c => c.name, c => c.purpose.value, c => c.topic.value] as ((
            c: Channel,
          ) => string)[]).flatMap(fn =>
            channels
              .filter(c => !c.is_archived && fuzzyIncludes(fn(c), q))
              .map(({ id, name, purpose, topic }) => ({
                snippet: purpose.value.length ? purpose.value : topic.value,
                title: `Channel #${name}`,
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
                channel: {
                  is_channel: boolean;
                  is_private: boolean;
                  name: string;
                };
                permalink: string;
                text: string | undefined;
                /** e.g. "1508284197.000015" */
                ts: string;
                user: null | string;
                username: string;
              }[];
              paging: { pages: number };
            };
          }>> =>
            axiosClient.get("/search.messages", {
              params: { count: PAGE_SIZE, page: zeroIndexedPage + 1, query: q },
            });

          const firstPageResponse = await getPage(0);
          const numPages = Math.max(
            firstPageResponse.data.messages.paging.pages,
            1,
          );
          const pageResponses = await Promise.all(
            Array(Math.ceil(Math.min(numPages, MAX_RESULTS / PAGE_SIZE)) - 1)
              .fill(0)
              .map(({}, i) => getPage(i + 1)),
          );
          pageResponses.unshift(firstPageResponse);

          return pageResponses
            .flatMap(r => r.data.messages.matches)
            .filter(
              m =>
                m.channel.is_channel &&
                !m.channel.is_private &&
                (includeBotMessages || m.user) &&
                m.text?.trim().length,
            )
            .map(m => ({
              modified: parseInt(m.ts.split(".")[0], 10),
              snippet: m.text ? linkify(m.text) : undefined,
              title: `Message by @${m.username} in #${m.channel.name}`,
              url: m.permalink,
            }));
        })(),
      ])
    ).flat();
  },
};

export default engine;
