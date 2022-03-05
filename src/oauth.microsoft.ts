// Generate a Microsoft Graph refresh token (lasts for 90 days).
// https://docs.microsoft.com/en-us/azure/active-directory/develop/refresh-tokens#refresh-token-lifetime

import * as msal from "@azure/msal-node";
import * as express from "express";

if (!process.env.ID || !process.env.SECRET) {
  console.log(
    "Please provide environment variables ID and SECRET for Microsoft Graph OAuth",
  );
  process.exit(1);
}

// Create MSAL application object
const msalClient = new msal.ConfidentialClientApplication({
  auth: {
    authority: "https://login.microsoftonline.com/common/",
    clientId: process.env.ID,
    clientSecret: process.env.SECRET,
  },
});

const SCOPES = ["calendars.readwrite", "mailboxsettings.read", "user.read"];
const PORT = 3000;
const REDIRECT_URI = `http://localhost:${PORT}`;

const app = express();

// Handle OAuth redirect
app.get("/", async (req, res) => {
  const { code } = req.query;
  if (typeof code === "string") {
    // MSAL client returns access token(valid for 1 hour)
    await msalClient.acquireTokenByCode({
      code: code,
      redirectUri: REDIRECT_URI,
      scopes: SCOPES,
    });

    // But we will prefer the refresh token that is stored in cache
    // (valid for 90 days)
    const tokenCache = JSON.parse(msalClient.getTokenCache().serialize());
    const refreshTokenKey = Object.keys(tokenCache.RefreshToken)[0];
    const refreshToken = tokenCache.RefreshToken[refreshTokenKey].secret;

    // We can use the refresh token to get new access tokens during the
    // initialization of the engine(s) that use Microsoft Graph API OAuth
    console.log("\nRefresh token: ", refreshToken);
    res.status(200).send("Success! Close this tab and check your terminal.");
  } else {
    res.status(400).send("OAuth failed!");
  }

  process.exit(0);
});

app.listen(PORT, async () => {
  // Generate URL for authorization page.
  const authUrl = await msalClient.getAuthCodeUrl({
    redirectUri: REDIRECT_URI,
    scopes: SCOPES,
  });

  console.log(`Go here and grant permission (Microsoft): ${authUrl}`);
});
