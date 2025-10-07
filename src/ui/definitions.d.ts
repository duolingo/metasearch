// These definitions are declared as ambient so that they can be easily shared
// between frontend and backend code

interface Engine {
  id: string;
  init: (options: object) => void | Promise<void>;
  isSnippetLarge?: boolean;
  name: string | (() => string);
  search: (q: string) => Promise<Result[]>;
}

interface Result {
  /** Last modification date as Unix timestamp in seconds. */
  modified?: number;
  /** Most relevant = 0, least = Infinity. Read/written by frontend only. */
  relevance?: number;
  snippet?: string;
  title: string;
  url: string;
}

interface Window {
  gtag?: (action: string, id: string, data: object) => void;
  /** Mark.js */
  Mark: any;
  metasearch: {
    ENGINES: Record<string, Engine>;
    FOOTER?: string;
    TRACKING_ID?: string;
  };
  /** timeago.js */
  timeago: any;
}
