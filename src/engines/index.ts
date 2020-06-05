import confluence from "./confluence";
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

const engines: Engine[] = [confluence, hound, jenkins, jira];
export default engines;
