// Can't use import/require in this source file since its compiled JS is loaded
// directly into the browser

const { useEffect, useReducer, useState } = React;

interface ResultGroup {
  elapsedMs: number;
  engineId: string;
  results: Result[];
}

const { ENGINES } = window.metasearch;

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
        onChange={onChange}
        placeholder={"Search for anything!"}
        type="text"
        value={q}
      />
      <input className="submit" title="Search" type="submit" value="" />
    </form>
  </div>
);

const Sidebar = ({ resultGroups }: { resultGroups: ResultGroup[] }) => (
  <div className="sidebar">
    <ul>
      {Object.values(ENGINES)
        .sort((a, b) => (a.name > b.name ? 1 : -1))
        .map(engine => {
          const numResults = resultGroups.find(rg => rg.engineId === engine.id)
            ?.results.length;
          return (
            <li
              className={numResults ? "has-results" : undefined}
              key={engine.id}
              onClick={() => {
                if (!numResults) {
                  return;
                }
                const $results = document.querySelector(".results");
                const $resultGroup: HTMLDivElement | null = document.querySelector(
                  `[data-engine-results=${engine.id}]`,
                );
                if (!($results && $resultGroup)) {
                  return;
                }
                $results.scrollTo({
                  behavior: "smooth",
                  top: $resultGroup.offsetTop,
                });
              }}
              title={
                numResults === undefined
                  ? "Searching..."
                  : numResults
                  ? "Jump to results"
                  : "No results found"
              }
            >
              {engine.name}
              {numResults === undefined ? null : (
                <span className="num-results">{numResults}</span>
              )}
            </li>
          );
        })}
    </ul>
  </div>
);

const Results = ({ resultGroups }: { resultGroups: ResultGroup[] }) => (
  <div className="results">
    {resultGroups
      .filter(rg => rg.results.length)
      .map(({ elapsedMs, engineId, results }) => (
        <div
          className="result-group"
          data-engine-results={engineId}
          key={engineId}
        >
          <h2>{ENGINES[engineId].name}</h2>
          <span className="stats">
            {results.length} result{results.length === 1 ? "" : "s"} (
            {(elapsedMs / 1000).toFixed(2)} seconds)
          </span>
          {results.map((result, i) => (
            <div className="result" key={i}>
              <a className="title" href={result.url}>
                {result.title}
              </a>
              {result.snippet ? (
                <div
                  className="snippet"
                  dangerouslySetInnerHTML={{ __html: result.snippet }}
                />
              ) : null}
            </div>
          ))}
        </div>
      ))}
  </div>
);

const handleSearch = async (
  dispatch: React.Dispatch<ResultGroup | undefined>,
  q: string,
  createHistoryEntry: boolean,
) => {
  // Normalize and validate query
  q = q.trim().replace(/\s+/, " ");
  if (!/\w/.test(q)) {
    console.log(`Invalid query: ${q}`);
    return;
  }

  // Update browser URL and tab title
  const path = `/?q=${encodeURIComponent(q)}`;
  createHistoryEntry
    ? window.history.pushState(null, "", path)
    : window.history.replaceState(null, "", path);
  document.title = `${q} - Metasearch`;

  // Clear results
  dispatch(undefined);

  // Get results
  const start = Date.now();
  let slowestEngine: string | undefined;
  await Promise.all(
    Object.values(ENGINES).map(async engine => {
      const start = Date.now();
      const results = await (
        await fetch(`/api/search?${querify({ engine: engine.id, q })}`)
      ).json();
      dispatch({
        elapsedMs: Date.now() - start,
        engineId: engine.id,
        results,
      });
      slowestEngine = engine.id;
    }),
  );
  console.log(
    `Slowest engine (${slowestEngine}) took ${Math.round(
      Date.now() - start,
    )}ms`,
  );
};

const App = () => {
  const [q, setQ] = useState<string>("");
  const [resultGroups, dispatch] = useReducer(
    (state: ResultGroup[], action: ResultGroup | undefined) =>
      action ? [...state, action] : [],
    [],
  );

  useEffect(() => {
    // Run query on initial page load and on HTML5 history change
    const runUrlQ = () => {
      const urlQ = new URLSearchParams(window.location.search).get("q");
      if (urlQ) {
        setQ(urlQ);
        handleSearch(dispatch, urlQ, false);
      }
    };
    runUrlQ();
    window.addEventListener("popstate", runUrlQ);
  }, []);

  return (
    <>
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
        onSearch={q => handleSearch(dispatch, q, true)}
        q={q}
      />
      <Sidebar resultGroups={resultGroups} />
      <Results resultGroups={resultGroups} />
    </>
  );
};

ReactDOM.render(React.createElement(App), document.querySelector("#root"));
