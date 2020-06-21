import axios from "axios";

import { rateLimit } from "./index";

let getProjects: (() => Promise<Set<string>>) | undefined;
let org: string | undefined;

const engine: Engine = {
  id: "rollbar",
  init: ({ organization, token }: { organization: string; token: string }) => {
    const client = axios.create({ baseURL: "https://api.rollbar.com/api/1" });

    getProjects = rateLimit(async () => {
      // https://explorer.docs.rollbar.com/#operation/list-all-projects
      const data: { result: { name: null | string }[] } = (
        await client.get("/projects", { params: { access_token: token } })
      ).data;
      return new Set(
        data.result.map(p => p.name).filter((n): n is string => !!n),
      );
    }, 4);
    org = organization;
  },
  name: "Rollbar",
  search: async q => {
    if (!(getProjects && org)) {
      throw Error("Engine not initialized");
    }

    return Array.from(await getProjects())
      .filter(n => n.toLowerCase().includes(q.toLowerCase()))
      .sort()
      .map(n => ({ title: n, url: `https://rollbar.com/${org}/${n}/` }));
  },
};

export default engine;
