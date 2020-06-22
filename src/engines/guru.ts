import axios, { AxiosInstance } from "axios";

let client: AxiosInstance | undefined;

const engine: Engine = {
  id: "guru",
  init: ({ token, user }: { token: string; user: string }) => {
    client = axios.create({
      auth: { password: token, username: user },
      baseURL: "https://api.getguru.com/api/v1",
    });
  },
  name: "Guru",
  search: async q => {
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
          searchTerms: `"${q.replace(/"/g, "")}"`,
          sortField: "popularity",
          sortOrder: "desc",
        },
      })
    ).data;
    return data.map(c => ({
      // Strip Guru's HTML formatting attributes
      snippet: c.content.replace(/ (class|data-[\w-]+|style|width)=".*?"/g, ""),
      title: c.collection
        ? `${c.collection.name} > ${c.preferredPhrase}`
        : c.preferredPhrase,
      url: `https://app.getguru.com/card/${c.slug}`,
    }));
  },
};

export default engine;
