import axios from "axios";

import { rateLimit } from "./index";

interface Job {
  description: string;
  name: string;
  url: string;
}

let getJobs: (() => Promise<Set<Job>>) | undefined;

const engine: Engine = {
  id: "jenkins",
  init: ({ origin }: { origin: string }) => {
    const client = axios.create({ baseURL: origin });

    getJobs = rateLimit(async () => {
      // https://stackoverflow.com/a/25685928
      const data: {
        jobs: Pick<Job, "name">[];
      } = (await client.get("/api/json")).data;
      const jobs = data.jobs.map(j => j.name);
      return new Set(
        await Promise.all(
          jobs.map<Promise<Job>>(
            async name => (await client.get(`/job/${name}/api/json`)).data,
          ),
        ),
      );
    }, 4);
  },
  name: "Jenkins",
  search: async q => {
    if (!getJobs) {
      throw Error("Engine not initialized");
    }

    return Array.from(await getJobs())
      .filter(j =>
        [j.name, j.description].some(s =>
          s.toLowerCase().includes(q.toLowerCase()),
        ),
      )
      .sort((a, b) => (a.name > b.name ? 1 : -1))
      .map(j => ({
        snippet: j.description.length ? j.description : undefined,
        title: j.name,
        url: j.url,
      }));
  },
};

export default engine;
