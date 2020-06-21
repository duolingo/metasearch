import confluence from "./confluence";
import drive from "./drive";
import dropbox from "./dropbox";
import figma from "./figma";
import github from "./github";
import groups from "./groups";
import hound from "./hound";
import jenkins from "./jenkins";
import jira from "./jira";
import pagerduty from "./pagerduty";
import pingboard from "./pingboard";
import rollbar from "./rollbar";
import slack from "./slack";
import talentlms from "./talentlms";
import zoom from "./zoom";

/** Replaces all `"` with `\"`. */
export const escapeQuotes = (s: string) => s.replace(/"/g, '\\"');

/**
 * Calls the provided function every N hours and returns a wrapper function
 * that itself returns the cached result of the provided function's most
 * recent invocation.
 *
 * The provided function must be parameterless since the cached result would
 * be not just stale but also incorrect in the case that different parameter
 * values were provided to the current call and the cached call.
 */
export const rateLimit = <R, F extends () => R>(
  fn: F,
  intervalHours: number,
): F => {
  let lastResult = fn();
  setInterval(() => {
    lastResult = fn();
  }, intervalHours * 60 * 60 * 1000);
  return (() => lastResult) as F;
};

const engines: Engine[] = [
  confluence,
  drive,
  dropbox,
  figma,
  github,
  groups,
  hound,
  jenkins,
  jira,
  pagerduty,
  pingboard,
  rollbar,
  slack,
  talentlms,
  zoom,
];
export default engines;
