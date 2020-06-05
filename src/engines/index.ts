import confluence from "./confluence";
import github from "./github";
import hound from "./hound";
import jenkins from "./jenkins";
import jira from "./jira";

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

export const escapeQuotes = (s: string) => s.replace(/"/g, '\\"');

/**
 * Wraps a function so that it returns the last invocation's cached result if
 * called multiple times during a cooldown period of N minutes.
 *
 * The wrapped function must be parameterless since the cached result would be
 * not just stale but also incorrect in the case that different parameter
 * values were provided to the current call and the cached call.
 */
export const rateLimit = <R, F extends () => R>(
  f: F,
  intervalMinutes: number,
): F => {
  let lastRunAt = -Infinity;
  let lastResult: any;
  return ((() => {
    const now = Date.now();
    if (now < lastRunAt + intervalMinutes * 60 * 1000) {
      return lastResult;
    }
    lastRunAt = now;
    lastResult = f();
    return lastResult;
  }) as unknown) as F;
};

const engines: Engine[] = [confluence, github, hound, jenkins, jira];
export default engines;
