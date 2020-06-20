// Can't use import/require in this source file since its compiled JS is loaded
// directly into the browser

const { useEffect, useReducer, useState } = React;

interface ResultGroup {
  engineId: string;
  results: Result[];
}

/** Converts an object to a query string that includes a cache-busting param */
const querify = (params: Record<string, string> = {}) =>
  Object.entries({ ...params, _: Date.now() })
    .sort((a, b) => (a[0] > b[0] ? 1 : -1))
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");

const Header = ({ onSearch }: { onSearch: (q: string) => any }) => {
  const [q, setQ] = useState("");

  // Prefill query if present in URL
  useEffect(() => {
    (async () => {
      const urlQ = new URLSearchParams(window.location.search).get("q");
      urlQ && setQ(urlQ);
    })();
  }, []);

  return (
    <div className="header">
      <form
        onSubmit={e => {
          onSearch(q);
          e.preventDefault();
        }}
      >
        <input
          autoFocus
          onChange={e => setQ(e.target.value)}
          type="text"
          value={q}
        />
        <input type="submit" value="🔎" />
      </form>
    </div>
  );
};

const Sidebar = ({
  engines,
  resultGroups,
}: {
  engines: Record<string, Engine>;
  resultGroups: ResultGroup[];
}) => (
  <div className="sidebar">
    <ul>
      {Object.values(engines)
        .sort((a, b) => (a.name > b.name ? 1 : -1))
        .map(engine => {
          const numResults = resultGroups.find(rg => rg.engineId === engine.id)
            ?.results.length;
          return (
            <li key={engine.id}>
              {engine.name}
              {numResults === undefined ? null : <span>{numResults}</span>}
            </li>
          );
        })}
    </ul>
  </div>
);

const Results = ({
  engines,
  resultGroups,
}: {
  engines: Record<string, Engine>;
  resultGroups: ResultGroup[];
}) => (
  <div className="results">
    {resultGroups
      .filter(rg => rg.results.length)
      .map(resultGroup => (
        <div key={resultGroup.engineId}>
          <h2>{engines[resultGroup.engineId].name}</h2>
          {resultGroup.results.map((result, i) => (
            <div key={i}>
              <a className="title" href={result.url}>
                {result.title}
              </a>
              <p className="snippet">{result.snippet}</p>
            </div>
          ))}
        </div>
      ))}
  </div>
);

const App = () => {
  const [initialQ, setInitialQ] = useState<string | undefined>(undefined);
  const [engines, setEngines] = useState<Record<string, Engine>>({});
  const [resultGroups, dispatch] = useReducer(
    (state: ResultGroup[], action: ResultGroup | undefined) =>
      action ? [...state, action] : [],
    [],
  );

  const handleSearch = async (q: string) => {
    // Normalize and validate query
    q = q.trim().replace(/\s+/, " ");
    if (!/\w/.test(q)) {
      console.log(`Invalid query: ${q}`);
      return;
    }

    // Update URL
    window.history.replaceState(null, "", `/?q=${encodeURIComponent(q)}`);

    // Clear results
    dispatch(undefined);

    // Get results
    const start = Date.now();
    let slowestEngine: string | undefined;
    await Promise.all(
      Object.values(engines).map(async engine => {
        dispatch({
          engineId: engine.id,
          results: await (
            await fetch(`/api/search?${querify({ engine: engine.id, q })}`)
          ).json(),
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

  // Load engine data
  useEffect(() => {
    (async () => {
      setEngines(await (await fetch(`/api/engines?${querify()}`)).json());
      const urlQ = new URLSearchParams(window.location.search).get("q");
      urlQ && setInitialQ(urlQ);
    })();
  }, []);

  // Run initial query if present
  useEffect(() => {
    if (engines && initialQ) {
      setInitialQ(undefined);
      handleSearch(initialQ);
    }
  }, [engines, initialQ]);

  return (
    <>
      <Header onSearch={handleSearch} />
      <Sidebar engines={engines} resultGroups={resultGroups} />
      <Results engines={engines} resultGroups={resultGroups} />
    </>
  );
};

ReactDOM.render(React.createElement(App), document.querySelector("#root"));
