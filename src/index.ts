import * as fs from "fs";

import * as express from "express";
import { safeLoad } from "js-yaml";

import engines from "./engines";

(async () => {
  // Load config
  const config: { engines: { id: "hound"; url: string }[] } = (() => {
    // Locate config file
    const DOCKER_MOUNT = "/data";
    const CONFIG_FILENAME = "config.yaml";
    const dockerizedConfig = `${DOCKER_MOUNT}/${CONFIG_FILENAME}`;
    const configFile = fs.existsSync("/.dockerenv")
      ? dockerizedConfig
      : CONFIG_FILENAME;
    if (!fs.existsSync(configFile)) {
      throw Error(`Metasearch config file '${configFile}' not found`);
    }

    // Parse config file and expand environment variables
    return safeLoad(
      fs
        .readFileSync(configFile, "utf8")
        .replace(/\$\{(\w+)(?::([^}]*))?\}/g, ({}, varName, defaultValue) => {
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
        }),
    );
  })();
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
    try {
      res.send(await engine.search(q));
    } catch (ex) {
      res.status(500);
      res.send("{}");
      if (ex.isAxiosError) {
        const {
          request: { method, path },
          response: { data },
        } = ex;
        console.error(`500 error: ${method} ${path}`);
        throw Error(JSON.stringify(data));
      }
      throw ex;
    }
  });
  app.listen(port, () => console.log(`Serving at http://localhost:${port}`));
})();
