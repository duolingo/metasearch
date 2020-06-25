import axios, { AxiosError, AxiosInstance, AxiosResponse } from "axios";

import { rateLimit } from "./index";

let getClients: (() => Promise<Record<string, AxiosInstance>>) | undefined;

const engine: Engine = {
  id: "lingo",
  init: ({ kits }: { kits: string[] }) => {
    const COOLDOWN_HOURS = 1;
    const getClient = async (kit: string) => {
      interface KitResponse {
        result: { kit: { kit_uuid: string; name: string } };
      }

      // Log into Lingo using their web browser flow. There are three recognized
      // and supported formats for a kit URL: (A) contains kit UUID and
      // kit_token param, (B) contains human-readable slug and kit_token param,
      // (C) contains only human-readable slug. A and B both require a cookie to
      // be included when calling the search API, while C doesn't.
      const [{}, spaceId, kitFragment, kitToken] =
        kit.match(/\/(\d+)\/k\/([^?]+)(?:\?kit_token=([\w-]+))?/) ?? [];

      // Determine kit UUID
      let kitName: string | undefined;
      const kitUuid = /^\w{8}-\w{4}-\w{4}-\w{4}-\w{12}$/.test(kitFragment)
        ? // Handle URL format A
          kitFragment
        : // Handle URL formats B and C
          await (async () => {
            try {
              const data: KitResponse = (
                await axios.get(
                  `https://api.lingoapp.com/v4/kits/${spaceId}/${
                    kitFragment.split("-").slice(-1)[0]
                  }`,
                )
              ).data;
              kitName = data.result.kit.name;
              return data.result.kit.kit_uuid;
            } catch (ex) {
              if (
                ((e): e is AxiosError => e.isAxiosError)(ex) &&
                ex.response?.status === 401
              ) {
                return ex.response.data.error.details.kit_uuid as string;
              }
              throw ex;
            }
          })();

      // Create client with appropriate cookie (or lack thereof)
      const headers = kitToken
        ? // Handle URL formats A and B
          await (async () => {
            let tokenResponse: AxiosResponse | undefined;
            try {
              // Tokens currently last 2 weeks according to this API route's
              // response
              tokenResponse = await axios.post(
                "https://api.lingoapp.com/v4/auth/password/",
                {
                  kit_uuid: kitUuid,
                  password: kitToken,
                  space_id: parseInt(spaceId, 10),
                },
                { headers: { "Content-Type": "application/json" } },
              );
            } catch (ex) {
              // Lingo's login route is fairly aggressively rate-limited, in
              // which case we just fail silently and try again later
              if (
                ((e): e is AxiosError => e.isAxiosError)(ex) &&
                ex.response?.status === 429
              ) {
                console.log(
                  `Lingo kit is rate-limited! Will try again in ${COOLDOWN_HOURS} hour(s): ${kit}`,
                );
                return null;
              }
              throw ex;
            }
            const token = (tokenResponse?.headers["set-cookie"] as string[])
              .find(c => /^lingo_tokens=[^;]/.test(c))
              ?.split(/[=;]/)[1];
            if (!token) {
              throw Error("Lingo login failed");
            }
            return { Cookie: `lingo_tokens=${token}` };
          })()
        : // Handle URL format C
          undefined;
      if (headers === null) {
        return [];
      }
      const client = axios.create({
        baseURL: `https://api.lingoapp.com/v4/kits/${kitUuid}`,
        headers,
      });

      // Determine kit name if still unknown at this point
      if (!kitName) {
        const response: KitResponse = (
          await axios.get(
            `https://api.lingoapp.com/v4/kits/${spaceId}/${kitUuid}`,
            { headers },
          )
        ).data;
        kitName = response.result.kit.name;
      }

      return [kitName, client];
    };
    getClients = rateLimit(
      async () =>
        Object.fromEntries(
          (await Promise.all(kits.map(getClient))).filter(
            entry => entry.length,
          ),
        ),
      COOLDOWN_HOURS,
    );
  },
  name: "Lingo",
  search: async q => {
    if (!getClients) {
      throw Error("Engine not initialized");
    }

    const clients = await getClients();
    return (
      await Promise.all(
        Object.entries(clients).map(async ([kitName, client]) => {
          const data: {
            result: {
              sections: {
                items: {
                  asset: {
                    name: string;
                    permalink: string;
                    thumbnails: { "292": string };
                  };
                  short_id: string;
                  space_id: number;
                }[];
                section: { name: string };
              }[];
            };
          } = (
            await client.get("/search", { params: { limit: 1000, query: q } })
          ).data;
          return data.result.sections.flatMap(s =>
            s.items.map(item => {
              // Construct authenticated URL to asset preview page
              const authParams = item.asset.permalink.match(/\?.+/)?.[0] ?? "";
              const url = `https://www.lingoapp.com/${item.space_id}/a/${item.short_id}${authParams}`;

              return {
                snippet: `<a href="${url}"><img src="${item.asset.thumbnails["292"]}"></a>`,
                title: `${kitName} > ${s.section.name} > ${item.asset.name}`,
                url,
              };
            }),
          );
        }),
      )
    )
      .flat()
      .sort((a, b) => (a.title > b.title ? 1 : -1));
  },
};

export default engine;
