import * as fs from "fs";

import { google } from "googleapis";
import { OAuth2Client } from "google-auth-library";

let auth: OAuth2Client | undefined;

const engine: Engine = {
  id: "drive",
  init: ({ credentials, token }: { credentials: string; token: string }) => {
    // https://github.com/googleapis/google-api-nodejs-client/tree/62f8193#oauth2-client
    const {
      web: { client_id, client_secret },
    } = JSON.parse(fs.readFileSync(credentials).toString());
    auth = new google.auth.OAuth2(client_id, client_secret);
    auth.setCredentials({ refresh_token: token });
  },
  name: "Google Drive",
  search: async q => {
    if (!auth) {
      throw Error("Engine not initialized");
    }

    const MIMETYPE_TO_PATH = {
      "application/vnd.google-apps.document": "document",
      "application/vnd.google-apps.spreadsheet": "spreadsheets",
    };

    // https://developers.google.com/drive/api/v3/search-files
    const drive = google.drive({ version: "v3", auth });
    const data = await drive.files.list({
      // Searches "Visible to anyone in..."
      // https://developers.google.com/drive/api/v3/search-files#search_the_corpora
      corpora: "domain",
      fields: "files(description, id, kind, mimeType, name)",
      q: `fullText contains '${q}'`,
      spaces: "drive",
    });
    return (
      data.data.files?.map(f => ({
        snippet: f.description ?? undefined,
        title: f.name ?? "Drive file",
        url: `https://docs.google.com/${MIMETYPE_TO_PATH[f.mimeType ?? ""] ??
          "file"}/d/${f.id}/edit`,
      })) ?? []
    );
  },
};

export default engine;
