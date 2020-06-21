// Generate a Google OAuth2 refresh token. This requires human interaction but
// must only be done once. The refresh token is effectively a password that can
// be saved and reused indefinitely for Google auth.
// https://martinfowler.com/articles/command-line-google.html

import * as fs from "fs";

import * as express from "express";
import { google } from "googleapis";

/**
 * Should be kept as the union of all scopes required by each of Metasearch's
 * engines
 */
const SCOPES = [
  "https://www.googleapis.com/auth/admin.directory.group.readonly",
  "https://www.googleapis.com/auth/drive.readonly",
];
const PORT = 3001;
const REDIRECT_URI = `http://localhost:${PORT}/`;

// Create OAuth client
// https://github.com/googleapis/google-api-nodejs-client/tree/62f8193#oauth2-client
const {
  web: { client_id, client_secret, redirect_uris },
} = JSON.parse(fs.readFileSync(0).toString());
if (!redirect_uris.includes(REDIRECT_URI)) {
  console.log(`Please add ${REDIRECT_URI} to authorized redirect URIs first.`);
  process.exit(1);
}
const oauth2Client = new google.auth.OAuth2(
  client_id,
  client_secret,
  "http://localhost:3001/",
);

const app = express();

// Handle OAuth redirect
app.get("/", async (req, res) => {
  const { code } = req.query;
  if (typeof code === "string") {
    const {
      tokens: { refresh_token },
    } = await oauth2Client.getToken(code);
    console.log(`Refresh token: ${refresh_token}`);
    res.status(200).send("Success! Close this tab and check your terminal.");
  } else {
    res.status(400).send("OAuth failed!");
  }
  process.exit(0);
});

app.listen(PORT, () => {
  // Generate URL for authorization page
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    // https://github.com/googleapis/google-api-nodejs-client/issues/750#issuecomment-368873635
    prompt: "consent",
    scope: SCOPES,
  });
  console.log(`Go here and grant permission: ${authUrl}`);
});
