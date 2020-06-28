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

/** Removes dangerous HTML tags to prevent XSS. */
export const sanitizeHtml = (s: string) => sanitize(s, SANITIZATION_OPTIONS);

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
export const rateLimit = <R, F extends () => Promise<R>>(
  fn: F,
  intervalHours: number,
): F => {
  // Wrap the provided function to cache its result
  let lastResult: R | undefined;
  const resultCachingFn = async () => {
    lastResult = await fn();
    return lastResult;
  };

  // Call provided function both immediately and on an interval
  let lastPromise = resultCachingFn();
  setInterval(() => {
    lastPromise = resultCachingFn();
  }, intervalHours * 60 * 60 * 1000);

  // Prefer returning the last resolved promise, falling back to a pending one
  return (() => (lastResult ? Promise.resolve(lastResult) : lastPromise)) as F;
};
