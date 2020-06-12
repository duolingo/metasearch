import axios from "axios";

import { rateLimit } from "./index";

interface Model {
  description: null | string;
  html_url: string;
  name: string;
  type: "schedule" | "service";
}

let getSchedules: (() => Promise<Set<Model>>) | undefined;
let getServices: (() => Promise<Set<Model>>) | undefined;

const engine: Engine = {
  id: "pagerduty",
  init: ({ token }: { token: string }) => {
    const client = axios.create({
      baseURL: "https://api.pagerduty.com",
      headers: {
        Accept: "application/vnd.pagerduty+json;version=2",
        Authorization: `Token token=${token}`,
      },
    });

    // TODO: Paginate properly? Maximum value of `limit` is 100, default is 25
    // https://developer.pagerduty.com/docs/rest-api-v2/pagination/

    getSchedules = rateLimit(async () => {
      const data: {
        schedules: Model[];
      } = (await client.get("/schedules", { params: { limit: 100 } })).data;
      return new Set(data.schedules);
    }, 4);

    getServices = rateLimit(async () => {
      const data: {
        services: Model[];
      } = (await client.get("/services", { params: { limit: 100 } })).data;
      return new Set(data.services);
    }, 4);
  },
  name: "PagerDuty",
  search: async q => {
    if (!(getSchedules && getServices)) {
      throw Error("Engine not initialized");
    }

    return (await Promise.all([getSchedules(), getServices()]))
      .flatMap(s => Array.from(s))
      .filter(m =>
        [m.name, m.description].some(s =>
          (s ?? "").toLowerCase().includes(q.toLowerCase()),
        ),
      )
      .map(m => ({
        snippet: m.description ?? undefined,
        title: `${m.name} ${m.type}`,
        url: m.html_url,
      }));
  },
};

export default engine;
