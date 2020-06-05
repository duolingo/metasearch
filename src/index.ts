import { readFileSync } from "fs";

import * as express from "express";
import { safeLoad } from "js-yaml";

import engines from "./engines";

const main = async () => {
  // Load config
  const config: { engines: { id: "hound"; url: string }[] } = safeLoad(
    readFileSync("config.yaml", "utf8").replace(
      /\$\{(\w+)(?::([^}]*))?\}/g,
      ({}, varName, defaultValue) => {
        const varValue = process.env[varName];
        if (varValue) {
          return varValue;
        }
        if (defaultValue) {
          return defaultValue;
        }
        throw Error(
          `Config references nonexistent environment variable '${varName}'`,
        );
      },
    ),
  );
  if (!config.engines) {
    throw Error("No engines specified");
  }

  // Initialize engines
  const engineMap = Object.fromEntries(engines.map(e => [e.id, e]));
  await Promise.all(
    Object.values(config.engines).map(async engineOptions => {
      const engine = engineMap[engineOptions.id];
      if (!engine) {
        throw Error(`Unrecognized engine '${engineOptions.id}'`);
      }
      await engine.init(engineOptions);
    }),
  );

  // Set up server
  const app = express();
  const port = 3000;
  app.get(`/search`, async (req, res) => {
    const { engine: engineId, q } = req.query as Record<string, string>;
    const engine = engineMap[engineId];
    if (!engine) {
      res.status(400);
      res.send(engineId);
      return;
    }
    res.send(await engine.search(q));
  });
  app.listen(port, () => console.log(`Serving at http://localhost:${port}`));
};

// Wrap the entire script to print Axios errors more usefully
process.on("unhandledRejection", ex => {
  throw ex;
});
(async () => {
  try {
    await main();
  } catch (ex) {
    const axiosResponse = ex?.response;
    if (axiosResponse) {
      const {
        data: {
          response: { data },
        },
        request: { method, path },
      } = axiosResponse;
      console.error(`${method} ${path}\n${data}`);
    }
    throw ex;
  }
})();
