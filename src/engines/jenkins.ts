import axios, { AxiosInstance } from "axios";

import { Engine } from "./index";

let client: AxiosInstance | undefined;

const engine: Engine = {
  id: "jenkins",
  init: ({ origin }: { origin: string }) => {
    client = axios.create({ baseURL: origin });
  },
  search: async q => {
    if (!client) {
      throw Error("Engine not initialized");
    }

    // https://stackoverflow.com/a/25685928
    const data: {
      jobs: { name: string; url: string }[];
    } = (await client.get("/api/json")).data;
    return data.jobs
      .filter(j => j.name.toLowerCase().includes(q.toLowerCase()))
      .map(j => ({
        title: j.name,
        url: j.url,
      }));
  },
};

export default engine;
