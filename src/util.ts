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
  // Strip images that either require authentication or are referenced with
  // relative paths
  exclusiveFilter: ({ attribs: { src }, tag }) =>
    tag === "img" &&
    (!/^https?:/.test(src) || /(atlassian\.net|getguru\.com)/.test(src)),
};

export const sanitizeHtml = (s: string) => sanitize(s, SANITIZATION_OPTIONS);
