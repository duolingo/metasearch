// Can't use import/require in this source file since its compiled JS is loaded
// directly into the browser

const { useEffect, useReducer, useState } = React;

interface ResultGroup {
  elapsedMs: number;
  engineId: string;
  results: Result[];
}

const { ENGINES, FOOTER, TRACKING_ID } = window.metasearch;

/** Converts an object to a query string that includes a cache-busting param */
const querify = (params: Record<string, string> = {}) =>
  Object.entries({ ...params, _: Date.now() })
    .sort((a, b) => (a[0] > b[0] ? 1 : -1))
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");

const Header = ({
  onChange,
  onSearch,
  q,
}: {
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSearch: (q: string) => any;
  q: string;
}) => (
  <div className="header">
    <form
      onSubmit={e => {
        onSearch(q);
        e.preventDefault();
      }}
    >
      <input
        autoFocus
        className="search-box"
        // For Firefox's "Add a Keyword for this Search..." feature
        name="q"
        onChange={onChange}
        placeholder={"Search for anything!"}
        type="text"
        value={q}
      />
      <input className="submit" title="Search" type="submit" value="" />
    </form>
  </div>
);

type SortMode = "az" | "best" | "recent";
const SORT_MODES: Record<
  SortMode,
  { name: string; sortFn: (a: Result, b: Result) => number }
> = {
  az: { name: "A-Z", sortFn: (a, b) => (a.title > b.title ? 1 : -1) },
  best: {
    name: "Best",
    sortFn: (a, b) =>
      (a.relevance ?? Infinity) > (b.relevance ?? Infinity) ? 1 : -1,
  },
  recent: {
    name: "Recent",
    sortFn: (a, b) => ((a.modified ?? 0) < (b.modified ?? 0) ? 1 : -1),
  },
};

const Settings = ({
  enableSorting,
  onSort,
  onToggleTheme,
  sortMode,
}: {
  enableSorting: boolean;
  onSort: (sort: SortMode) => void;
  onToggleTheme: () => void;
  sortMode: SortMode;
}) => (
  <div className="sorter">
    {enableSorting
      ? ["best", "recent", "az"].map((id: SortMode) =>
          sortMode === id ? (
            <span>{SORT_MODES[id].name}</span>
          ) : (
            <a href="javascript:;" onClick={() => onSort(id)}>
              {SORT_MODES[id].name}
            </a>
          ),
        )
      : null}
    <a href="javascript:;" onClick={onToggleTheme} title="Toggle dark theme">
      <img src="/theme.png" />
    </a>
  </div>
);

const Sidebar = ({
  visible,
  hiddenEngines,
  onToggle,
  resultGroups,
}: {
  visible: boolean;
  hiddenEngines: string[];
  onToggle: (engineId: string) => void;
  resultGroups: ResultGroup[];
}) => (
  <div className="sidebar">
    <ul>
      {visible &&
        Object.values(ENGINES)
          .sort((a, b) => (a.name > b.name ? 1 : -1))
          .map((engine) => {
            const numResults = resultGroups.find(
              (rg) => rg.engineId === engine.id
            )?.results.length;
            return (
              <li
                className={
                  numResults && !hiddenEngines.includes(engine.id)
                    ? "has-results"
                    : "is-hidden"
                }
                key={engine.id}
                onClick={() => {
                  if (!numResults) {
                    return;
                  }
                  const $results = document.querySelector(".results");
                  const $resultGroup: HTMLDivElement | null =
                    document.querySelector(
                      `[data-engine-results=${engine.id}]`
                    );
                  if (!($results && $resultGroup)) {
                    return;
                  }

                  const engineHidden = hiddenEngines.includes(engine.id);
                  const needsScroll =
                    $results.scrollTop != $resultGroup.offsetTop;

                  if (engineHidden || !needsScroll) {
                    onToggle(engine.id);
                  }

                  if (needsScroll) {
                    $results.scrollTo({
                      behavior: "smooth",
                      top: $resultGroup.offsetTop,
                    });
                  }
                }}
                title={
                  numResults === undefined
                    ? "Searching..."
                    : numResults
                    ? "Jump to results"
                    : "No results found"
                }
              >
                <div className="engine-wrap">
                  {engine.name}
                  {numResults === undefined ? (
                    <span className="spinner">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 16 16"
                      >
                        <g className="spinner-color">
                          <path
                            d="M8 15c-3.86 0-7-3.141-7-7 0-3.86 3.14-7 7-7 3.859 0 7 3.14 7 7 0 3.859-3.141 7-7 7zM8 3C5.243 3 3 5.243 3 8s2.243 5 5 5 5-2.243 5-5-2.243-5-5-5z"
                            opacity=".3"
                          />
                          <path d="M14 9a1 1 0 0 1-1-1c0-2.757-2.243-5-5-5a1 1 0 0 1 0-2c3.859 0 7 3.14 7 7a1 1 0 0 1-1 1z" />
                        </g>
                      </svg>
                    </span>
                  ) : (
                    <span className="num-results">{numResults}</span>
                  )}
                </div>
              </li>
            );
          })}
    </ul>
  </div>
);

/** Converts 1593668572 to "July 2, 2020" */
const formatDate = (() => {
  const DATE_FORMATTER = new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "long",
    timeZone: "America/New_York",
    year: "numeric",
  });

  return (unixTimestampSeconds: number) =>
    DATE_FORMATTER.format(new Date(unixTimestampSeconds * 1000));
})();

const Results = ({
  hiddenEngines,
  onToggle,
  resultGroups,
  sortMode,
}: {
  hiddenEngines: string[];
  onToggle: (engineId: string) => void;
  resultGroups: ResultGroup[];
  sortMode: SortMode;
}) => (
  <div className="results">
    {resultGroups
      .filter(rg => rg.results.length)
      .map(({ elapsedMs, engineId, results }) => {
        const showResults = !hiddenEngines.includes(engineId);
        return (
          <div
            className="result-group"
            data-engine-results={engineId}
            key={engineId}
          >
            <h2
              className={showResults ? undefined : "hide-results"}
              onClick={() => onToggle(engineId)}
              title="Toggle results"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 -256 1792 1792"
              >
                <path
                  d="M1426.44 407.864q0 26-19 45l-448 448q-19 19-45 19t-45-19l-448-448q-19-19-19-45t19-45q19-19 45-19h896q26 0 45 19t19 45z"
                  fill="currentColor"
                />
              </svg>
              {ENGINES[engineId].name}
            </h2>
            <span className="stats">
              {results.length} result{results.length === 1 ? "" : "s"} (
              {(elapsedMs / 1000).toFixed(2)} seconds)
            </span>
            {showResults
              ? results.sort(SORT_MODES[sortMode].sortFn).map((result, i) => (
                  <div className="result" key={i}>
                    <div>
                      <a
                        className="title"
                        dangerouslySetInnerHTML={{ __html: result.title }}
                        href={result.url}
                      />
                      {result.modified ? (
                        <span
                          className="modified"
                          title={formatDate(result.modified)}
                        >
                          {window.timeago.format(result.modified * 1000)}
                        </span>
                      ) : null}
                    </div>
                    {result.snippet ? (
                      <div
                        className="snippet"
                        dangerouslySetInnerHTML={{ __html: result.snippet }}
                      />
                    ) : null}
                  </div>
                ))
              : null}
          </div>
        );
      })}
  </div>
);

const memoize = <F extends Function>(fn: F) => {
  let cache: Record<string, any> = {};
  return (((...args: any[]) => {
    const cacheKey = JSON.stringify(args);
    if (!(cacheKey in cache)) {
      cache[cacheKey] = fn(...args);
    }
    return cache[cacheKey];
  }) as unknown) as F;
};

const getResults = memoize(
  async (id: string, q: string): Promise<Result[]> =>
    await (await fetch(`/api/search?${querify({ engine: id, q })}`)).json(),
);

const handleSearch = async (
  dispatch: React.Dispatch<ResultGroup | undefined>,
  q: string,
  createHistoryEntry: boolean,
) => {
  // Normalize and validate query
  q = q.trim().replace(/\s+/, " ");
  if (!/\S/.test(q)) {
    return;
  }

  // Update browser URL and tab title
  const path = `/?q=${encodeURIComponent(q)}`;
  createHistoryEntry
    ? window.history.pushState(null, "", path)
    : window.history.replaceState(null, "", path);
  TRACKING_ID && window.gtag?.("config", TRACKING_ID, { page_path: path });
  document.title = `${q} - Metasearch`;

  // Clear results
  dispatch(undefined);

  // Get results
  const highlightRegex = new RegExp(
    q.replace(/\W|_/g, "").split("").join("(\\W|_)*"),
    "gi",
  );
  await Promise.all(
    Object.values(ENGINES).map(async engine => {
      // Fetch results
      const start = Date.now();
      const results = await getResults(engine.id, q);

      // Abort if no longer viewing this query
      if (getUrlQ() !== q) {
        return;
      }

      // Highlight query
      for (let i = 0; i < results.length; ++i) {
        const result = results[i];
        result.relevance = i;
        for (const property of ["title", "snippet"] as const) {
          const value = result[property];
          if (!value) {
            continue;
          }
          const node = new DOMParser().parseFromString(value, "text/html").body;
          new window.Mark(node).markRegExp(highlightRegex);
          result[property] = node.innerHTML;
        }
      }

      dispatch({ elapsedMs: Date.now() - start, engineId: engine.id, results });
    }),
  );
};

/** Helper for interacting with localStorage */
const STORAGE_MANAGER = (() => {
  type Data = Partial<{
    dark: boolean;
    hiddenEngines: string[];
    sortMode: SortMode;
  }>;
  let cachedData: Data;
  try {
    cachedData = JSON.parse(window.localStorage.metasearch || "{}");
  } catch {
    console.log("Failed to read from localStorage");
    cachedData = {};
  }
  return {
    get: () => cachedData,
    set: (data: Data) => {
      const shouldWrite = cachedData !== data;
      cachedData = data;
      if (shouldWrite) {
        try {
          window.localStorage.metasearch = JSON.stringify(data);
        } catch {
          console.log("Failed to write to localStorage");
        }
      }
    },
  };
})();

const getUrlQ = () =>
  new URLSearchParams(window.location.search).get("q") ?? "";

const App = () => {
  const [localData, setLocalData] = useState(STORAGE_MANAGER.get());
  const [q, setQ] = useState<string>("");
  const [resultGroups, dispatch] = useReducer(
    (state: ResultGroup[], action: ResultGroup | undefined) =>
      action ? [...state, action] : [],
    [],
  );

  useEffect(() => {
    // Run query on initial page load and on HTML5 history change
    const runUrlQ = () => {
      const urlQ = getUrlQ();
      setQ(urlQ);
      handleSearch(dispatch, urlQ, false);
    };
    runUrlQ();
    window.addEventListener("popstate", runUrlQ);
  }, []);

  useEffect(() => {
    STORAGE_MANAGER.set(localData);
  }, [localData]);

  const sortMode: SortMode = localData.sortMode || "best";
  return (
    <div className={`theme${localData.dark ? " dark" : ""}`}>
      <div
        className="logo"
        onClick={() => {
          document
            .querySelector(".results")
            ?.scrollTo({ behavior: "smooth", top: 0 });
        }}
      >
        Metasearch
      </div>
      <Header
        onChange={e => setQ(e.target.value)}
        onSearch={q => handleSearch(dispatch, q, !!getUrlQ().trim())}
        q={q}
      />
      <Settings
        enableSorting={resultGroups.length > 0}
        onSort={sortMode => setLocalData({ ...localData, sortMode })}
        onToggleTheme={() =>
          setLocalData({ ...localData, dark: !localData.dark })
        }
        sortMode={sortMode}
      />
      <Sidebar
        visible={resultGroups.length > 0}
        hiddenEngines={localData.hiddenEngines || []}
        onToggle={engineId => {
          const hiddenEngines = localData.hiddenEngines || [];
          setLocalData({
            ...localData,
            hiddenEngines: hiddenEngines.includes(engineId)
              ? hiddenEngines.filter(id => id !== engineId)
              : [...hiddenEngines, engineId].sort(),
          });
        }}
        resultGroups={resultGroups}
      />
      <Results
        hiddenEngines={localData.hiddenEngines || []}
        onToggle={engineId => {
          const hiddenEngines = localData.hiddenEngines || [];
          setLocalData({
            ...localData,
            hiddenEngines: hiddenEngines.includes(engineId)
              ? hiddenEngines.filter(id => id !== engineId)
              : [...hiddenEngines, engineId].sort(),
          });
        }}
        resultGroups={resultGroups}
        sortMode={sortMode}
      />
      <div
        className="footer"
        dangerouslySetInnerHTML={FOOTER ? { __html: FOOTER } : undefined}
      />
    </div>
  );
};

ReactDOM.render(React.createElement(App), document.querySelector("#root"));
