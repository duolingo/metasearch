import * as fs from "fs";

import { AxiosError } from "axios";
import * as compression from "compression";
import * as ejs from "ejs";
import * as express from "express";
import { createHttpTerminator } from "http-terminator";
import { safeLoad } from "js-yaml";

import engines from "./engines";
import { sanitizeHtml } from "./util";

(async () => {
  // Set up exception handler
  const exceptionHandler = (ex: Error) => {
    console.error(`\x1b[31m${ex.message}\x1b[0m`);
    process.exit(1);
  };
  process.on("uncaughtException", exceptionHandler);
  process.on("unhandledRejection", exceptionHandler);

  // Load config
  interface Config {
    engines: Record<string, { name?: string }>;
    footer?: string;
    trackingId?: string;
  }
  const config: Config = (() => {
    const DOCKER_MOUNT = "/data";
    const CONFIG_FILENAME = "config.yaml";

    // Locate user-provided config file
    const dockerizedConfig = `${DOCKER_MOUNT}/${CONFIG_FILENAME}`;
    const configFile = fs.existsSync("/.dockerenv")
      ? dockerizedConfig
      : CONFIG_FILENAME;
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

    /** Recursively pulls out all values from a complex object */
    const allValues = (node: any): Set<any> =>
      new Set(
        node && typeof node === "object"
          ? (Array.isArray(node) ? node : Object.values(node)).flatMap(child =>
              Array.from(allValues(child)),
            )
          : [node],
      );

    // Abort if user didn't follow instructions to customize config.yaml
    if (allValues(userConfig).has("example")) {
      throw Error(
        "The engine options in config.yaml are populated with dummy values. Please customize the option values for engines you want to use and delete the config blocks for engines you don't want to use.",
      );
    }

    return userConfig;
  })();
  if (!config.engines) {
    throw Error("No engines specified");
  }

  // Initialize engines
  const uninitializedEngineMap = Object.fromEntries(
    engines.map(e => [e.id, e]),
  );
  const engineMap = Object.fromEntries(
    Object.entries(config.engines).map(([id, options]) => {
      const uninitializedEngine = uninitializedEngineMap[id];
      if (!uninitializedEngine) {
        throw Error(`Unrecognized engine '${id}'`);
      }
      uninitializedEngine.init(options);
      return [
        id,
        {
          ...uninitializedEngine,
          name: options.name ?? uninitializedEngine.name,
        },
      ];
    }),
  );

  // Generate index.html
  fs.writeFileSync(
    "dist/index.html",
    await ejs.renderFile("src/ui/index.html", {
      metasearch: {
        ENGINES: engineMap,
        FOOTER: config.footer,
        TRACKING_ID: config.trackingId,
      },
    }),
    "utf8",
  );

  // Set up server
  const app = express();
  const port = 3000;
  app.use(compression());
  app.use(express.static("dist"));

  // Declare search route for individual engines
  app.get("/api/search", async (req, res) => {
    // Check that desired engine exists
    const { engine: engineId, q } = req.query as Record<string, string>;
    const engine = engineMap[engineId];
    if (!engine) {
      res.status(400);
      res.json({ error: `Unknown engine: ${engineId}` });
      return;
    }

    // Query engine
    try {
      res.json(
        (await engine.search(q)).map(result => ({
          ...result,
          snippet: result.snippet
            ? sanitizeHtml(
                engine.isSnippetLarge
                  ? `<blockquote>${result.snippet}</blockquote>`
                  : result.snippet,
              )
            : undefined,
        })),
      );
    } catch (ex) {
      // TODO: Instead return 500 and show error UI
      res.json([]);

      // If Axios error, keep only the useful parts
      if (ex.isAxiosError) {
        const {
          code,
          config: { baseURL, method, url },
          response: { data = undefined, status = undefined } = {},
        } = ex as AxiosError;
        console.error(
          `${status ??
            code} ${method?.toUpperCase()} ${baseURL}${url}: ${JSON.stringify(
            data,
          )}`,
        );
      } else {
        console.error(ex);
      }
    }
  });

  // Start server
  const httpTerminator = createHttpTerminator({
    server: app.listen(port, () => {
      console.log(`Serving Metasearch at http://localhost:${port}`);
    }),
  });
  process.on("SIGTERM", async () => {
    console.log("Gracefully shutting down...");
    await httpTerminator.terminate();
    console.log("Closed all open connections. Bye!");
    process.exit(0);
  });
})();
