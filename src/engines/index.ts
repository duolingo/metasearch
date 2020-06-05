import confluence from "./confluence";
import hound from "./hound";
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

const engines: Engine[] = [confluence, hound, jira];

export default engines;
