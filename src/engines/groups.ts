import * as fs from "fs";

import { admin_directory_v1, google } from "googleapis";

import { rateLimit } from "../util";

let domain: string | undefined;
let getGroups:
  | (() => Promise<Set<admin_directory_v1.Schema$Group>>)
  | undefined;

const engine: Engine = {
  id: "groups",
  init: ({
    credentials,
    domain: configDomain,
    token,
  }: {
    credentials: string;
    domain: string;
    token: string;
  }) => {
    // https://github.com/googleapis/google-api-nodejs-client/tree/62f8193#oauth2-client
    const {
      web: { client_id, client_secret },
    } = JSON.parse(fs.readFileSync(credentials).toString());
    const auth = new google.auth.OAuth2(client_id, client_secret);
    auth.setCredentials({ refresh_token: token });

    domain = configDomain;

    getGroups = rateLimit(async () => {
      const { groups } = google.admin({ auth, version: "directory_v1" });
      // https://developers.google.com/admin-sdk/directory/v1/reference/groups/list
      const data = await groups.list({ domain });
      return new Set(data.data.groups || []);
    }, 4);
  },
  name: "Google Groups",
  search: async q => {
    if (!getGroups) {
      throw Error("Engine not initialized");
    }

    return Array.from(await getGroups())
      .filter(g =>
        [g.email, g.name, g.description].some(s =>
          s?.toLowerCase().includes(q.toLowerCase()),
        ),
      )
      .sort((a, b) => ((a.email ?? "") > (b.email ?? "") ? 1 : -1))
      .map(g => ({
        snippet: g.description ?? undefined,
        title: `${g.name}: ${g.email}`,
        url: `https://groups.google.com/a/${domain}/forum/#!members/${
          g.email?.split("@")[0]
        }`,
      }));
  },
};

export default engine;
