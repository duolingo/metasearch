import axios, { AxiosError, AxiosInstance } from "axios";

import { rateLimit } from "./index";

let getClients: (() => Promise<Record<string, AxiosInstance>>) | undefined;

const engine: Engine = {
  id: "lingo",
  init: ({ kits }: { kits: string[] }) => {
    getClients = rateLimit(
      async () =>
        Object.fromEntries(
          await Promise.all(
            kits.map(async kit => {
              interface KitResponse {
                result: { kit: { kit_uuid: string; name: string } };
              }

              // Log into Lingo using their web browser flow. There are three
              // recognized and supported formats for a kit URL: (A) contains
              // kit UUID and kit_token param, (B) contains human-readable slug
              // and kit_token param, (C) contains only human-readable slug. A
              // and B both require a cookie to be included when calling the
              // search API, while C doesn't.
              const [{}, spaceId, kitFragment, kitToken] =
                kit.match(/\/(\d+)\/k\/([^?]+)(?:\?kit_token=([\w-]+))?/) ?? [];

              // Determine kit UUID
              let kitName: string | undefined;
              const kitUuid = /^\w{8}-\w{4}-\w{4}-\w{4}-\w{12}$/.test(
                kitFragment,
              )
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
                        return ex.response.data.error.details
                          .kit_uuid as string;
                      }
                      throw ex;
                    }
                  })();

              // Create client with appropriate cookie (or lack thereof)
              const headers = kitToken
                ? // Handle URL formats A and B
                  await (async () => {
                    // Tokens currently last 2 weeks according to this API route's
                    // response
                    const tokenResponse = await axios.post(
                      "https://api.lingoapp.com/v4/auth/password/",
                      {
                        kit_uuid: kitUuid,
                        password: kitToken,
                        space_id: parseInt(spaceId, 10),
                      },
                      { headers: { "Content-Type": "application/json" } },
                    );
                    const token = (tokenResponse.headers[
                      "set-cookie"
                    ] as string[])
                      .find(c => /^lingo_tokens=[^;]/.test(c))
                      ?.split(/[=;]/)[1];
                    if (!token) {
                      throw Error("Lingo login failed");
                    }
                    return { Cookie: `lingo_tokens=${token}` };
                  })()
                : // Handle URL format C
                  undefined;
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
            }),
          ),
        ),
      24,
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
          return data.result.sections.map(s =>
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
      .flat(2)
      .sort((a, b) => (a.title > b.title ? 1 : -1));
  },
};

export default engine;
