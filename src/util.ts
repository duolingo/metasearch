import * as sanitize from "sanitize-html";

const SANITIZATION_OPTIONS: sanitize.IOptions = {
  allowedTags: [
    "a",
    "abbr",
    "b",
    "blockquote",
    "br",
    "caption",
    "code",
    "div",
    "em",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "hr",
    "i",
    "img",
    "li",
    "nl",
    "ol",
    "p",
    "pre",
    "span",
    "strike",
    "strong",
    "table",
    "tbody",
    "td",
    "th",
    "thead",
    "tr",
    "u",
    "ul",
  ],
  // Strip Jira emoticons and other images referenced with relative paths
  exclusiveFilter: frame =>
    frame.tag === "img" && !/^https?:/.test(frame.attribs["src"]),
};

export const sanitizeHtml = (s: string) => sanitize(s, SANITIZATION_OPTIONS);
