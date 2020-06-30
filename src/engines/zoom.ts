import axios from "axios";
import * as jsonwebtoken from "jsonwebtoken";

import { fuzzyIncludes, rateLimit } from "../util";

interface Room {
  id: string;
  name: string;
  room_id: string;
  status: "Available" | "InMeeting" | "Offline" | "UnderConstruction";
}

let getRooms: (() => Promise<Set<Room>>) | undefined;

const engine: Engine = {
  id: "zoom",
  init: ({ key, secret }: { key: string; secret: string }) => {
    const client = axios.create({ baseURL: "https://api.zoom.us/v2" });

    getRooms = rateLimit(async () => {
      // https://marketplace.zoom.us/docs/guides/auth/jwt
      const exp = Date.now() + 60 * 1000; // 1 minute
      const jwt = jsonwebtoken.sign({ exp, iss: key }, secret);

      const PAGE_SIZE = 300; // Maximum value allowed by Zoom backend
      // https://marketplace.zoom.us/docs/api-reference/zoom-api/rooms/listzoomrooms
      const data: { page_size: number; rooms: Room[] } = (
        await client.get("/rooms", {
          headers: { Authorization: `Bearer ${jwt}` },
          params: { page_size: PAGE_SIZE },
        })
      ).data;
      if (data.page_size === data.rooms.length) {
        throw Error("Too many Zoom rooms - must implement pagination");
      }
      return new Set(data.rooms);
    }, 24);
  },
  name: "Zoom",
  search: async q => {
    if (!getRooms) {
      throw Error("Engine not initialized");
    }

    return Array.from(await getRooms())
      .filter(r => fuzzyIncludes(r.name, q))
      .sort((a, b) => (a.name > b.name ? 1 : -1))
      .map(r => ({
        snippet: `Current status: ${r.status}`,
        title: r.name,
        // If room name contains a join link, set it as the URL
        url: `https://${r.name.match(/\w+\.zoom\.us\/j\/\d{10,}/)?.[0] ??
          "zoom.us/"}`,
      }));
  },
};

export default engine;
