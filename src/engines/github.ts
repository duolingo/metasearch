import axios, { AxiosInstance } from "axios";
import * as marked from "marked";

import { escapeQuotes, fuzzyIncludes, getUnixTime, rateLimit } from "../util";

interface Repo {
  description: null | string;
  isArchived: boolean;
  isFork: boolean;
  name: string;
}

let client: AxiosInstance | undefined;
let getRepos: (() => Promise<Set<Repo>>) | undefined;
let org: string | undefined;

const engine: Engine = {
  id: "github",
  init: ({
    organization,
    origin = "https://api.github.com",
    token,
  }: {
    organization: string;
    origin: string;
    token: string;
  }) => {
    const axiosClient = axios.create({
      baseURL: origin,
      headers: { Authorization: `bearer ${token}` },
    });
    client = axiosClient;

    getRepos = rateLimit(async () => {
      let cursor: string | undefined;
      const repos = new Set<Repo>();
      while (true) {
        // https://developer.github.com/v4/object/repository/
        const {
          data,
        }: {
          data?: {
            organization: {
              repositories: {
                edges: { node: Repo }[];
                pageInfo: { endCursor: string; hasNextPage: boolean };
              };
            };
          };
        } = (
          await axiosClient.post(
            "/graphql",
            JSON.stringify({
              query: `query {
      organization(login: "${organization}") { repositories(first: 100${
                cursor ? `, after: "${cursor}"` : ""
              }) {
          edges { node { description isArchived isFork name } }
          pageInfo { endCursor hasNextPage }
      } } }`,
            }),
          )
        ).data;

        if (!data) {
          break;
        }

        const { edges, pageInfo } = data.organization.repositories;
        edges.map(e => e.node).forEach(r => repos.add(r));

        if (pageInfo.hasNextPage) {
          cursor = pageInfo.endCursor;
        } else {
          break;
        }
      }

      return repos;
    }, 1);
    org = organization;
  },
  name: "GitHub",
  search: async q => {
    if (!(client && getRepos && org)) {
      throw Error("Engine not initialized");
    }

    return (
      await Promise.all([
        // Search repo names and descriptions
        (async () => {
          if (!(getRepos && org)) {
            throw Error("Engine not initialized");
          }

          return Array.from(await getRepos())
            .filter(
              r =>
                !r.isArchived &&
                !r.isFork &&
                [r.description, r.name].some(s => fuzzyIncludes(s, q)),
            )
            .sort((a, b) => (a.name > b.name ? 1 : -1))
            .map(r => ({
              // Strip emojis
              snippet:
                r.description?.replace(/ *:[a-z-]+: */g, "") || undefined,
              title: `Repo ${org}/${r.name}`,
              url: `https://github.com/${org}/${r.name}`,
            }));
        })(),
        // Search issues and pull requests
        (async () => {
          if (!(client && org)) {
            throw Error("Engine not initialized");
          }

          try {
            // TODO: Paginate
            // https://developer.github.com/v3/search/#search-issues-and-pull-requests
            const data: {
              items: {
                body: null | string;
                html_url: string;
                number: number;
                pull_request?: object;
                title: string;
                /** e.g. "2020-06-29T21:46:58Z" */
                updated_at: string;
                user: { login: string };
              }[];
            } = (
              await client.get("/search/issues", {
                params: {
                  per_page: 100,
                  q: /\b(is|author|org):\w/.test(q)
                    ? /\borg:\w/.test(q)
                      ? q
                      : `org:${org} ${q}`
                    : `org:${org} "${escapeQuotes(q)}"`,
                },
              })
            ).data;
            return data.items.map(item => ({
              modified: getUnixTime(item.updated_at),
              snippet: item.body
                ? `<blockquote>${marked(item.body)}</blockquote>`
                : undefined,
              title: `${item.pull_request ? "PR" : "Issue"} in ${
                item.html_url.match(/github\.com\/([^\/]+\/[^\/]+)\//)?.[1]
              }: ${item.title}`,
              url: item.html_url,
            }));
          } catch {
            return [];
          }
        })(),
      ])
    ).flat();
  },
};

export default engine;
