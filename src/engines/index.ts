import aws from "./aws";
import confluence from "./confluence";
import drive from "./drive";
import dropbox from "./dropbox";
import figma from "./figma";
import github from "./github";
import gitlab from "./gitlab";
import greenhouse from "./greenhouse";
import groups from "./groups";
import guru from "./guru";
import hound from "./hound";
import jenkins from "./jenkins";
import jira from "./jira";
import lingo from "./lingo";
import mattermost from "./mattermost";
import notion from "./notion";
import outlookCalendar from "./outlookCalendar";
import pagerduty from "./pagerduty";
import pingboard from "./pingboard";
import rollbar from "./rollbar";
import slack from "./slack";
import stackoverflow from "./stackoverflow";
import talentlms from "./talentlms";
import trello from "./trello";
import website from "./website";
import zoom from "./zoom";

const engines: Engine[] = [
  aws,
  confluence,
  drive,
  dropbox,
  figma,
  github,
  gitlab,
  greenhouse,
  groups,
  guru,
  hound,
  jenkins,
  jira,
  lingo,
  mattermost,
  notion,
  outlookCalendar,
  pagerduty,
  pingboard,
  rollbar,
  slack,
  stackoverflow,
  talentlms,
  trello,
  website,
  zoom,
];
export default engines;
