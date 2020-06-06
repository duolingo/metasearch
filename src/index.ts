import * as fs from "fs";

import * as express from "express";
import { safeLoad } from "js-yaml";

import engines from "./engines";

(async () => {
  // Load config
  interface Config {
    engines: Record<string, object>;
  }
  const config: Config = (() => {
    const DOCKER_MOUNT = "/data";
    const USER_CONFIG_FILENAME = "config.yaml";
    const EXAMPLE_CONFIG_FILENAME = "config-example.yaml";

    // Locate user-provided config file
    const dockerizedConfig = `${DOCKER_MOUNT}/${USER_CONFIG_FILENAME}`;
    const configFile = fs.existsSync("/.dockerenv")
      ? dockerizedConfig
      : USER_CONFIG_FILENAME;
    if (!fs.existsSync(configFile)) {
      throw Error(`Metasearch config file '${configFile}' not found`);
    }

    // Parse user-provided config file and expand environment variables
    const userConfig: Config = safeLoad(
      fs
        .readFileSync(configFile, "utf8")
        .replace(/\$\{(\w+)\}/g, ({}, varName) => {
          const varValue = process.env[varName];
          if (varValue) {
            return varValue;
          }

          // Keep ${FOOBAR} because it's used as an example in the YAML comment
          if (varName === "FOOBAR") {
            return "${FOOBAR}";
          }

          throw Error(
            `Config references nonexistent environment variable '${varName}'`,
          );
        }),
    );

    // Parse example config file and abort if user erroneously (1) specified an
    // unrecognized engine ID or (2) left any of their engine configs equal to
    // the example's engine configs (which are populated with invalid dummy
    // data)
    const exampleConfig: Config = safeLoad(
      fs.readFileSync(EXAMPLE_CONFIG_FILENAME, "utf8"),
    );
    const uncustomizedEngineOptions = Object.entries(
      userConfig.engines,
    ).flatMap(([id, userOptions]) => {
      const exampleOptions = exampleConfig.engines[id];
      if (!exampleOptions) {
        throw Error(`Unrecognized engine '${id}'`);
      }
      return Object.entries(userOptions)
        .filter(([k, v]) => exampleOptions[k] === v)
        .map(([k, {}]) => `\n  Option '${k}' of engine '${id}'`);
    });
    if (uncustomizedEngineOptions.length) {
      throw Error(`Invalid engine options:${uncustomizedEngineOptions}`);
    }

    return userConfig;
  })();
  if (!config.engines) {
    throw Error("No engines specified");
  }

  // Initialize engines
  const engineMap = Object.fromEntries(engines.map(e => [e.id, e]));
  await Promise.all(
    Object.entries(config.engines).map(([id, options]) =>
      engineMap[id].init(options),
    ),
  );

  // Set up server
  const app = express();
  const port = 3000;

  // Declare search route for individual engines
  app.get(`/search`, async (req, res) => {
    // Check that desired engine exists
    const { engine: engineId, q } = req.query as Record<string, string>;
    const engine = engineMap[engineId];
    if (!engine) {
      res.status(400);
      res.send(JSON.stringify({ error: `Unknown engine: ${engineId}` }));
      return;
    }

    // Query engine
    try {
      res.send(await engine.search(q));
    } catch (ex) {
      res.status(500);
      res.send(JSON.stringify({}));

      // If Axios error, print only the useful parts
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

  // Start server
  app.listen(port, () => console.log(`Serving at http://localhost:${port}`));
})();
