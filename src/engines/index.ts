import confluence from "./confluence";
import dropbox from "./dropbox";
import figma from "./figma";
import github from "./github";
import hound from "./hound";
import jenkins from "./jenkins";
import jira from "./jira";
import zoom from "./zoom";

export interface Engine {
  id: string;
  init: (options: object) => void | Promise<void>;
  search: (q: string) => Promise<Result[]>;
}

export interface Result {
  snippet?: string;
  title: string;
  url: string;
}

/** Replaces all `"` with `\"`. */
export const escapeQuotes = (s: string) => s.replace(/"/g, '\\"');

/**
 * Wraps a function so that it returns the last invocation's cached result if
 * called multiple times during a cooldown period of N hours.
 *
 * The wrapped function must be parameterless since the cached result would be
 * not just stale but also incorrect in the case that different parameter
 * values were provided to the current call and the cached call.
 */
export const rateLimit = <R, F extends () => R>(
  f: F,
  intervalHours: number,
): F => {
  let lastRunAt = -Infinity;
  let lastResult: any;
  return ((() => {
    const now = Date.now();
    if (now < lastRunAt + intervalHours * 60 * 60 * 1000) {
      return lastResult;
    }
    lastRunAt = now;
    lastResult = f();
    return lastResult;
  }) as unknown) as F;
};

const engines: Engine[] = [
  confluence,
  dropbox,
  figma,
  github,
  hound,
  jenkins,
  jira,
  zoom,
];
export default engines;
