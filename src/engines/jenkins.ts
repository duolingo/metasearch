import axios from "axios";

import { rateLimit } from "./index";

const JOB_FIELDS = ["description", "name", "url"] as const;

type Job = Record<typeof JOB_FIELDS[number], string>;

let getJobs: (() => Promise<Set<Job>>) | undefined;

const engine: Engine = {
  id: "jenkins",
  init: ({ origin }: { origin: string }) => {
    const client = axios.create({ baseURL: origin });

    getJobs = rateLimit(async () => {
      // https://stackoverflow.com/a/25685928
      const data: { jobs: Job[] } = (
        await client.get("/api/json", {
          params: { tree: `jobs[${JOB_FIELDS.join(",")}]` },
        })
      ).data;
      return new Set(data.jobs);
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
