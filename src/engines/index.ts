import aws from "./aws";
import confluence from "./confluence";
import drive from "./drive";
import dropbox from "./dropbox";
import figma from "./figma";
import github from "./github";
import greenhouse from "./greenhouse";
import groups from "./groups";
import guru from "./guru";
import hound from "./hound";
import jenkins from "./jenkins";
import jira from "./jira";
import lingo from "./lingo";
import pagerduty from "./pagerduty";
import pingboard from "./pingboard";
import rollbar from "./rollbar";
import slack from "./slack";
import trello from "./trello";
import talentlms from "./talentlms";
import website from "./website";
import zoom from "./zoom";
import notion from "./notion"

const engines: Engine[] = [
  aws,
  confluence,
  drive,
  dropbox,
  figma,
  github,
  greenhouse,
  groups,
  guru,
  hound,
  jenkins,
  jira,
  lingo,
  pagerduty,
  pingboard,
  rollbar,
  slack,
  talentlms,
  trello,
  website,
  zoom,
  notion
];
export default engines;
