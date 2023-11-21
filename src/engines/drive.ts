import * as fs from "fs";

import { google } from "googleapis";
import { OAuth2Client } from "google-auth-library";

import { getUnixTime } from "../util";

let auth: OAuth2Client | undefined;

// https://developers.google.com/drive/api/v3/mime-types
const getMimeInfo = (
  mimeType: null | string | undefined,
): { name: string; urlFragment: string } =>
  ({
    "application/vnd.google-apps.document": {
      name: "Doc",
      urlFragment: "document",
    },
    "application/vnd.google-apps.form": {
      name: "Survey",
      urlFragment: "forms",
    },
    "application/vnd.google-apps.presentation": {
      name: "Presentation",
      urlFragment: "presentation",
    },
    "application/vnd.google-apps.spreadsheet": {
      name: "Spreadsheet",
      urlFragment: "spreadsheets",
    },
  })[mimeType ?? ""] ?? { name: "File", urlFragment: "file" };

const engine: Engine = {
  id: "drive",
  init: ({ credentials, token }: { credentials: string; token: string }) => {
    // https://github.com/googleapis/google-api-nodejs-client/tree/62f8193#oauth2-client
    const {
      web: { client_id, client_secret },
    } = JSON.parse(fs.readFileSync(credentials, "utf8"));
    auth = new google.auth.OAuth2(client_id, client_secret);
    auth.setCredentials({ refresh_token: token });
  },
  name: "Google Drive",
  search: async q => {
    if (!auth) {
      throw Error("Engine not initialized");
    }

    const drive = google.drive({ version: "v3", auth });
    const data = await drive.files.list({
      // Searches "Visible to anyone in..."
      // https://developers.google.com/drive/api/v3/search-files#search_the_corpora
      corpora: "domain",
      fields: "files(description,id,kind,mimeType,modifiedTime,name,owners)",
      q: `fullText contains '${q.replace(/'/, "\\'")}'`,
      spaces: "drive",
    });
    return (
      data.data.files?.map(f => {
        const { name, urlFragment } = getMimeInfo(f.mimeType);
        return {
          modified: f.modifiedTime ? getUnixTime(f.modifiedTime) : undefined,
          snippet: f.description ?? `${name} by ${f.owners?.[0].displayName}`,
          title: f.name ?? "Drive file",
          url: `https://docs.google.com/${urlFragment}/d/${f.id}/edit`,
        };
      }) ?? []
    );
  },
};

export default engine;
