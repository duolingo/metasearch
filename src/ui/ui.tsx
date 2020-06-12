// Can't use import/require in this source file since its compiled JS is loaded
// directly into the browser

const { useEffect, useState } = React;

/** Converts an object to a query string that includes a cache-busting param */
const querify = (params: Record<string, string> = {}) =>
  Object.entries({ ...params, _: Date.now() })
    .sort((a, b) => (a[0] > b[0] ? 1 : -1))
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");

const Header = ({ onSearch }: { onSearch: (q: string) => any }) => {
  const [q, setQ] = useState("");

  return (
    <div className="header">
      <form
        onSubmit={e => {
          onSearch(q);
          e.preventDefault();
        }}
      >
        <input onChange={e => setQ(e.target.value)} type="text" />
        <input type="submit" value="🔎" />
      </form>
    </div>
  );
};

const Sidebar = ({ engines }: { engines: Engine[] }) => (
  <div className="sidebar">
    <ul>
      {engines.map(engine => (
        <li key={engine.id}>{engine.name}</li>
      ))}
    </ul>
  </div>
);

const Results = ({ results }: { results: Result[] }) => (
  <div className="results">
    {results.map((result, i) => (
      <div key={i}>
        <a href={result.url}>{result.title}</a>
        <p>{result.snippet}</p>
      </div>
    ))}
  </div>
);

const App = () => {
  const [engines, setEngines] = useState<Engine[]>([]);
  const [results, setResults] = useState<Result[]>([]);

  useEffect(() => {
    (async () =>
      setEngines(
        Object.values<Engine>(
          await (await fetch(`/api/engines?${querify()}`)).json(),
        ).sort((a, b) => (a.name > b.name ? 1 : -1)),
      ))();
  }, []);

  return (
    <>
      <Header
        onSearch={q => {
          setResults([]);
          let incomingResults: Result[] = [];
          engines.map(async engine => {
            const engineResults: Result[] = await (
              await fetch(`/api/search?${querify({ engine: engine.id, q })}`)
            ).json();
            incomingResults = [...incomingResults, ...engineResults];
            setResults(incomingResults);
          });
        }}
      />
      <Sidebar engines={engines} />
      <Results results={results} />
    </>
  );
};

ReactDOM.render(React.createElement(App), document.querySelector("#root"));
