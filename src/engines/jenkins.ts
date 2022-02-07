import axios, { AxiosRequestConfig } from "axios";

import { fuzzyIncludes, rateLimit } from "../util";

const JOB_FIELDS = ["description", "name", "url"] as const;

type Job = Record<typeof JOB_FIELDS[number], string>;

let getJobs: (() => Promise<Set<Job>>) | undefined;

const engine: Engine = {
  id: "jenkins",
  init: ({
    origin,
    token,
    user,
  }: {
    origin: string;
    token?: string;
    user?: string;
  }) => {
    let config: AxiosRequestConfig = {
      baseURL: origin,
    }
    // Include basic auth headers if token and user are set
    // https://www.jenkins.io/doc/book/system-administration/authenticating-scripted-clients/
    if (token && user) {
      config.auth = {
        username: user,
        password: token,
      }
    }
    const client = axios.create(config);

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
      .filter(j => [j.name, j.description].some(s => fuzzyIncludes(s, q)))
      .sort((a, b) => (a.name > b.name ? 1 : -1))
      .map(j => ({
        snippet: j.description.length ? j.description : undefined,
        title: j.name,
        url: j.url,
      }));
  },
};

export default engine;
