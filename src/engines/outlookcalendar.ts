import * as msal from "@azure/msal-node";
import * as graph from "@microsoft/microsoft-graph-client";
import * as dateFns from "date-fns";
import "isomorphic-fetch";

import { getUnixTime } from "../util";

const SCOPES = ["calendars.readwrite", "mailboxsettings.read", "user.read"];

let auth: graph.Client | undefined;

interface EventDate {
  dateTime: string;
  timeZone: string;
}

interface Event {
  body: {
    content: string;
    contentType: string;
  };
  bodyPreview: string;
  end: EventDate;
  id: string;
  lastModifiedDateTime: string;
  organizer: {
    emailAddress: {
      address: string;
      name: string;
    };
  };
  start: EventDate;
  subject: string;
  webLink: string;
}

const engine: Engine = {
  id: "outlookcalendar",
  init: ({
    clientId,
    clientSecret,
    token,
  }: {
    clientId: string;
    clientSecret: string;
    token: string;
  }) => {
    // Instantiate msal application object
    const msalClient = new msal.ConfidentialClientApplication({
      auth: {
        authority: "https://login.microsoftonline.com/common/",
        clientId,
        clientSecret,
      },
    });

    // Initialize Graph client
    auth = graph.Client.init({
      // Implement an auth provider that gets a token from the app's MSAL
      // instance
      authProvider: async (
        done: (error: any, accessToken: string | null) => void,
      ) => {
        try {
          // Use refresh token to acquire new access token
          const auth_result = await msalClient.acquireTokenByRefreshToken({
            refreshToken: token,
            scopes: SCOPES,
          });

          if (auth_result) {
            // First param to callback is the error,
            // Set to null in success case
            done(null, auth_result.accessToken);
          }
        } catch (err) {
          console.log(JSON.stringify(err, Object.getOwnPropertyNames(err)));
          done(err, null);
        }
      },
    });
  },
  name: "Outlook Calendar",
  search: async q => {
    if (!auth) {
      throw Error("Engine not initialized");
    }

    const today = new Date();
    const events = await auth
      .api("/me/calendarview")
      // Add the begin and end of the calendar window (20 year window, past and future)
      .query({
        endDateTime: dateFns.addDays(today, 912).toDateString(),
        startDateTime: dateFns.addDays(today, -912).toDateString(),
      })
      // Filter by the keyword specified by the user
      .filter(`contains(subject,'${q.replace(/'/g, "\\'")}')`)
      // Get just the properties used by the app
      .select(
        "id,lastModifiedDateTime,start,end,webLink,subject,bodyPreview,body,organizer",
      )
      // Order by start time
      .orderby("start/dateTime")
      // Get at most 100 results
      .top(100)
      .get();

    return events.value.map((e: Event) => {
      const date = new Date(e.start.dateTime);
      return {
        modified: getUnixTime(e.lastModifiedDateTime),
        snippet: `Organized by ${e.organizer.emailAddress.name}`,
        title: `${e.subject} on ${date.toLocaleDateString("en-US", {
          day: "numeric",
          month: "long",
          year: "numeric",
        })}`,
        url: e.webLink,
      };
    });
  },
};

export default engine;
