import { google } from "googleapis";
import { OAuth2Client } from "google-auth-library";

let authPromise: Promise<OAuth2Client> | undefined;

const engine: Engine = {
  id: "drive",
  init: ({ credentials }: { credentials: string }) => {
    // https://github.com/googleapis/google-api-nodejs-client#service-to-service-authentication
    authPromise = new google.auth.GoogleAuth({
      keyFile: credentials,
      scopes: ["https://www.googleapis.com/auth/drive"],
    }).getClient();
  },
  search: async q => {
    if (!authPromise) {
      throw Error("Engine not initialized");
    }

    const MIMETYPE_TO_PATH = {
      "application/vnd.google-apps.spreadsheet": "spreadsheets",
    };

    // https://developers.google.com/drive/api/v3/search-files
    const drive = google.drive({ version: "v3", auth: await authPromise });
    const data = await drive.files.list({
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
