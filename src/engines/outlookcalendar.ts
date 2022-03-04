import * as graph from "@microsoft/microsoft-graph-client";
import * as msal from "@azure/msal-node";
import "isomorphic-fetch";

import { getUnixTime } from "../util";
const SCOPES = ["user.read", "calendars.readwrite", "mailboxsettings.read"];

import * as dateFns from "date-fns";

let auth: graph.Client | undefined;

interface EventDate {
  dateTime: string;
  timeZone: string;
}

interface Event {
  id: string;
  lastModifiedDateTime: string;
  start: EventDate;
  end: EventDate;
  webLink: string;
  subject: string;
  bodyPreview: string;
  body: {
    contentType: string;
    content: string;
  };
  organizer: {
    emailAddress: {
      name: string;
      address: string;
    };
  };
}

const engine: Engine = {
  id: "outlookcalendar",
  init: ({ clientId, clientSecret, token }: { clientId: string; clientSecret: string; token: string }) => {

    // Instantiate msal application object
    const msalClient = new msal.ConfidentialClientApplication({
      auth: {
        clientId,
        authority: "https://login.microsoftonline.com/common/",
        clientSecret,
      },
    });

    // Initialize Graph client
    auth = graph.Client.init({
      // Implement an auth provider that gets a token
      // from the app's MSAL instance
      authProvider: async (
        done: (error: any, accessToken: string | null) => void,
      ) => {
        try {
          // Use refresh token to acquire new access token
          const auth_result = await msalClient.acquireTokenByRefreshToken({
            scopes: SCOPES,
            refreshToken: token,
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
  search: getCalendarView,
};

async function getCalendarView(
  q: string /*start: any, end: any, timeZone: any*/,
) {
  if (!auth) {
    throw Error("Engine not initialized");
  }

  const today = new Date();
  const startDate = dateFns.addDays(today, -912);
  const endDate = dateFns.addDays(today, 912);

  const events = await auth
    .api("/me/calendarview")
    // Add the begin and end of the calendar window (20 year window, past and future)
    .query({
      startDateTime: startDate.toDateString(),
      endDateTime: endDate.toDateString(),
    })
    // Filter by the keyword specified by the user
    .filter(`contains(subject,'${q.replace(/'/, "\\'")}')`)
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
        year: "numeric",
        month: "long",
        day: "numeric",
      })}`,
      url: e.webLink,
    };
  });
}

export default engine;
