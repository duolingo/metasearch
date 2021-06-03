import axios from "axios";

import { fuzzyIncludes, rateLimit } from "../util";

interface Employee {
  custom_fields?: Record<string, any>;
  email: string;
  first_name: string;
  id: string;
  interests: string[];
  job_title: string;
  last_name: string;
  nickname: string;
  skills: string[];
}

let getEmployees: (() => Promise<Set<Employee>>) | undefined;
let orgName: string | undefined;

const engine: Engine = {
  id: "pingboard",
  init: ({
    key,
    organization,
    secret,
  }: {
    key: string;
    organization: string;
    secret: string;
  }) => {
    const client = axios.create({ baseURL: "https://app.pingboard.com" });

    getEmployees = rateLimit(async () => {
      // https://pingboard.docs.apiary.io/#reference/authentication/client-credentials-flow
      const token: string = (
        await client.post(
          "/oauth/token",
          { client_id: key, client_secret: secret },
          { params: { grant_type: "client_credentials" } },
        )
      ).data.access_token;

      // https://pingboard.docs.apiary.io/#reference/users/users-collection/get-users
      const data: { users: Employee[] } = (
        await client.get("/api/v2/users", {
          headers: { Authorization: `Bearer ${token}` },
          params: { page_size: 1000 },
        })
      ).data;
      return new Set(data.users);
    }, 4);

    orgName = organization;
  },
  name: "Pingboard",
  search: async q => {
    if (!getEmployees) {
      throw Error("Engine not initialized");
    }

    return Array.from(await getEmployees())
      .filter(u =>
        [
          ...Object.values(u),
          ...Object.values(u.custom_fields ?? {}),
          ...u.interests,
          ...u.skills,
          `${u.first_name} ${u.last_name}`,
        ]
          .filter((v): v is string => typeof v === "string")
          .some(v => fuzzyIncludes(v, q)),
      )
      .sort((a, b) => (a.first_name > b.first_name ? 1 : -1))
      .map(u => ({
        snippet: `${u.email} - ${u.job_title}`,
        title: `${u.nickname?.length ? u.nickname : u.first_name} ${
          u.last_name
        }`,
        url: `https://${orgName}.pingboard.com/users/${u.id}`,
      }));
  },
};

export default engine;
