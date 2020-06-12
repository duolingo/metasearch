import axios, { AxiosInstance } from "axios";

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
          return ([c => c.name, c => c.purpose.value, c => c.topic.value] as ((
            c: Channel,
          ) => string)[]).flatMap(fn =>
            channels
              .filter(
                c =>
                  !c.is_archived &&
                  fn(c)
                    .toLowerCase()
                    .includes(q.toLowerCase()),
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
          // https://api.slack.com/methods/search.messages
          const data: {
            messages: {
              matches: {
                channel: { name: string };
                permalink: string;
                text: string;
                username: string;
              }[];
            };
          } = (await client.get("/search.messages", { params: { query: q } }))
            .data;
          return data.messages.matches.map(m => ({
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
