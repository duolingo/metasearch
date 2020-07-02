import axios, { AxiosInstance } from "axios";
import * as marked from "marked";

import { stripStopWords } from "../util";

let client: AxiosInstance | undefined;

const engine: Engine = {
  id: "guru",
  init: ({ token, user }: { token: string; user: string }) => {
    client = axios.create({
      auth: { password: token, username: user },
      baseURL: "https://api.getguru.com/api/v1",
    });
  },
  isSnippetLarge: true,
  name: "Guru",
  search: async q => {
    // Return both exact matches and lenient matches in that order
    const isExactQ = /^"[^"]+"$/.test(q);
    const [exactMatches, lenientMatches = []] = await Promise.all(
      (isExactQ ? [q] : [`"${q.replace(/"/g, "")}"`, stripStopWords(q)])
        .filter(searchTerms => searchTerms)
        .map(async searchTerms => {
          if (!client) {
            throw Error("Engine not initialized");
          }

          // https://developer.getguru.com/docs/listing-cards
          interface User {
            email: string;
            firstName: string;
            lastName: string;
          }
          const data: {
            boards: { id: string; title: string }[];
            collection: { id: string; name: string };
            content: string;
            lastModifiedBy: User;
            lastVerifiedBy: User;
            owner: User;
            preferredPhrase: string;
            slug: string;
            verificationState: "NEEDS_VERIFICATION" | "TRUSTED";
          }[] = (
            await client.get("/search/query", {
              params: {
                // By default, Guru splits the query on whitespace and returns all
                // results that contain *any* of those pieces. This is often extremely
                // noisy and generally not what people want or expect, so we wrap the
                // user's query in double-quotes in order to request only matches for
                // the entire string.
                searchTerms,
                sortField: "popularity",
                sortOrder: "desc",
              },
            })
          ).data;
          return data;
        }),
    );

    const exactMatchSlugs = new Set(exactMatches.map(m => m.slug));
    return [
      ...exactMatches,
      ...lenientMatches.filter(m => !exactMatchSlugs.has(m.slug)),
    ].map(c => ({
      snippet: c.content.includes("ghq-card")
        ? // Strip Guru's HTML formatting attributes
          c.content.replace(/ (class|data-[\w-]+|style|width)=".*?"/g, "")
        : marked(c.content),
      title: c.collection
        ? `${c.collection.name} > ${c.preferredPhrase}`
        : c.preferredPhrase,
      url: `https://app.getguru.com/card/${c.slug}`,
    }));
  },
};

export default engine;
