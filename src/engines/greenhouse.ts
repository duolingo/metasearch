import axios from "axios";
import * as he from "he";

import { rateLimit } from "../util";

interface Job {
  absolute_url: string;
  content: string;
  departments: { name: string }[];
  location: { name: string };
  title: string;
}

let getJobs: (() => Promise<Set<Job>>) | undefined;

const engine: Engine = {
  id: "greenhouse",
  init: ({ token }: { token: string }) => {
    const client = axios.create({
      baseURL: `https://boards-api.greenhouse.io/v1/boards/${token}`,
    });

    getJobs = rateLimit(async () => {
      // Get all jobs (without description)
      // https://developers.greenhouse.io/job-board.html#list-jobs
      const jobIdData: {
        jobs: { id: number }[];
      } = (await client.get("/jobs")).data;

      // Get job descriptions
      // https://developers.greenhouse.io/job-board.html#retrieve-a-job
      return new Set(
        await Promise.all(
          jobIdData.jobs.map<Promise<Job>>(async j => {
            const job = (await client.get(`/jobs/${j.id}`)).data;
            return { ...job, content: he.decode(job.content) };
          }),
        ),
      );
    }, 4);
  },
  isSnippetLarge: true,
  name: "Greenhouse",
  search: async q => {
    if (!getJobs) {
      throw Error("Engine not initialized");
    }

    return Array.from(await getJobs())
      .filter(j =>
        [
          j.title,
          j.content.replace(/<.+?>/g, " ").replace(/\s+/g, " "),
          ...j.departments.map(d => d.name),
        ].some(s => s.toLowerCase().includes(q.toLowerCase())),
      )
      .map(j => ({
        snippet: j.content,
        title: `${j.departments.map(d => d.name).join(", ")} > ${j.title} in ${
          j.location.name
        }`,
        url: j.absolute_url,
      }))
      .sort((a, b) => (a.title > b.title ? 1 : -1));
  },
};

export default engine;
