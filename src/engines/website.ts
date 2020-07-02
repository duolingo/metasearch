import axios from "axios";
import * as xml2js from "xml2js";

import { fuzzyIncludes, rateLimit, sanitizeHtml } from "../util";

interface Page {
  content: string;
  lastmod?: string;
  title: string;
  url: string;
}

let getPages: (() => Promise<Set<Page>>) | undefined;

const engine: Engine = {
  id: "website",
  init: ({ sitemaps }: { sitemaps: string[] }) => {
    const dateFormatter = new Intl.DateTimeFormat("en-US", {
      day: "numeric",
      month: "long",
      timeZone: "America/New_York",
      year: "numeric",
    });

    const getPage = async (sitemap: string) => {
      const xml: string = (await axios.get(sitemap)).data;
      const parsedXml: {
        urlset: { url: { lastmod?: string[]; loc: string[] }[] };
      } = await xml2js.parseStringPromise(xml);
      return (
        await Promise.all(
          parsedXml.urlset.url.map<Promise<Page | undefined>>(
            async ({ lastmod: [date] = [], loc: [url] }) => {
              try {
                const html: string = (await axios.get(url)).data;
                return {
                  content: sanitizeHtml(html)
                    .replace(/<.+?>/g, " ")
                    .replace(/\s+/g, " ")
                    .toLowerCase(),
                  lastmod: date
                    ? dateFormatter.format(new Date(date))
                    : undefined,
                  // Sanitization unescapes XML entities
                  title: sanitizeHtml(
                    html.match(/<title>(.+?)<\/title>/)?.[1] || url,
                  ),
                  url,
                };
              } catch {
                console.log(`Failed to scrape ${url}`);
                return undefined;
              }
            },
          ),
        )
      ).filter((p): p is Page => !!p);
    };

    getPages = rateLimit(
      async () => new Set((await Promise.all(sitemaps.map(getPage))).flat()),
      24,
    );
  },
  name: "Website",
  search: async q => {
    if (!getPages) {
      throw Error("Engine not initialized");
    }

    return Array.from(await getPages())
      .filter(
        p => p.content.includes(q.toLowerCase()) || fuzzyIncludes(p.title, q),
      )
      .sort((a, b) => (a.url > b.url ? 1 : -1))
      .map(p => ({
        snippet: p.lastmod,
        title: p.title,
        url: p.url,
      }));
  },
};

export default engine;
