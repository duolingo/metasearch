import axios, { AxiosInstance } from "axios";
import * as marked from "marked";

import { getUnixTime, rateLimit } from "../util";

let client: AxiosInstance | undefined;

interface Team {
  id: string;
  name: string;
}

interface Channel {
  id: string;
  name: string;
  display_name: string;
}

interface User {
  id: string;
  nickname: string;
  first_name: string;
  last_name: string;
  email: string;
}

let getChannels: (() => Promise<Set<Channel>>) | undefined;
let getUsers: (() => Promise<Set<User>>) | undefined;

let getTitle = async (channelId: string, userId: string) : Promise<string> => {

  if (!(getChannels && getUsers)) {
    throw Error("Engine not initialized");
  }

  const channel = Array.from(await getChannels()).find(channel => channel.id == channelId);
  const user = Array.from(await getUsers()).find(user => user.id == userId);

  const channelName = channel ? channel.display_name : channelId;
  let userName = userId;
  
  if (user) {
    if (user.nickname != "") {
      userName = user.nickname;
    } else if (user.first_name != "" || user.last_name != "") {
      userName = `${user.first_name} ${user.last_name}`.trim();
    } else {
      userName = user.email;
    }
  }

  return `${channelName} - ${userName}`;
}

let ori: string | undefined;
let teamId: string | undefined;
let teamName: string | undefined;

const engine: Engine = {
  id: "mattermost",
  init: ({
    origin,
    team,
    token,
  }: {
    origin: string;
    team: string;
    token: string;
  }) => {
    const axiosClient = axios.create({
      baseURL: `${origin}/api/v4`,
      headers: { Authorization: `bearer ${token}` },
    });
    client = axiosClient;

    getChannels = rateLimit(async () => {

      // https://api.mattermost.com/#operation/GetTeamByName
      const currentTeam: Team = (
        await axiosClient.get(`/teams/name/${team}`)
      ).data;

      teamId = currentTeam.id;

      // https://api.mattermost.com/#operation/GetAllChannels
      const data: Channel[] = (
        await axiosClient.get(`/teams/${teamId}/channels`)
      ).data;

      return new Set(data);
    }, 10);

    getUsers = rateLimit(async () => {
      // https://api.mattermost.com/#operation/GetUsers

      let page = 0;
      const users = new Set<User>();

      while(true) {
        const data: User[] = (
          await axiosClient.get(`/users`, {params: {page: page}})
        ).data;

        if (!data || data.length == 0) {
          break;
        }

        data.forEach(user => users.add(user));
        page += 1;
      }
      return users;
    }, 10);

    teamName = team;
    ori = origin;

  },
  name: "Mattermost",
  search: async q => {
    if (!(client && teamId && getChannels && getUsers)) {
      throw Error("Engine not initialized");
    }

    // https://api.mattermost.com/#operation/SearchPosts
    const data: {
      order: string[],
      posts: Record<string, { 
        id: string,
        user_id: string;
        channel_id: string;
        message: string;
        update_at: string;
      }>;
    } = (
      await client.post(`/teams/${teamId}/posts/search`, {
        terms: q
      })
    ).data;

    return await Promise.all(
      data.order
      .map(postId => data.posts[postId])
      .map(async post => {
        return {
          modified: getUnixTime(post.update_at),
          snippet: `<blockquote>${marked(post.message)}</blockquote>`,
          title: await getTitle(post.channel_id, post.user_id),
          url: `${ori}/${teamName}/pl/${post.id}`,
        }
      })
    );
  },
};

export default engine;
