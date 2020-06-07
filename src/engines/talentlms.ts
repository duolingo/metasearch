import axios from "axios";

import { Engine, rateLimit } from "./index";

interface Course {
  description: string;
  id: string;
  name: string;
  status: "active" | "inactive";
}

let getCourses: (() => Promise<Set<Course>>) | undefined;
let orgName: string | undefined;

const engine: Engine = {
  id: "talentlms",
  init: ({ key, organization }: { key: string; organization: string }) => {
    const client = axios.create({
      auth: { password: "", username: key },
      baseURL: `https://${organization}.talentlms.com/api`,
    });

    getCourses = rateLimit(async () => {
      // https://www.talentlms.com/pages/docs/TalentLMS-API-Documentation.pdf
      const data: Course[] = (await client.get("/v1/courses")).data;
      return new Set(data);
    }, 24);

    orgName = organization;
  },
  search: async q => {
    if (!getCourses) {
      throw Error("Engine not initialized");
    }

    return Array.from(await getCourses())
      .filter(
        c =>
          c.status === "active" &&
          [c.description, c.name].some(s =>
            s.toLowerCase().includes(q.toLowerCase()),
          ),
      )
      .sort((a, b) => (a.name > b.name ? 1 : -1))
      .map(c => ({
        snippet: c.description.length ? c.description : undefined,
        title: c.name,
        url: `https://${orgName}.talentlms.com/learner/courseinfo/id:${c.id}`,
      }));
  },
};

export default engine;
