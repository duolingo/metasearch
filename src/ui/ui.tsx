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

const Sidebar = ({ engines }: { engines: Record<string, Engine> }) => (
  <div className="sidebar">
    <ul>
      {Object.values(engines)
        .sort((a, b) => (a.name > b.name ? 1 : -1))
        .map(engine => (
          <li key={engine.id}>{engine.name}</li>
        ))}
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
              <a href={result.url}>{result.title}</a>
              <p>{result.snippet}</p>
            </div>
          ))}
        </div>
      ))}
  </div>
);

const App = () => {
  const [engines, setEngines] = useState<Record<string, Engine>>({});
  const [resultGroups, dispatch] = useReducer(
    (state: ResultGroup[], action: ResultGroup | undefined) =>
      action ? [...state, action] : [],
    [],
  );

  useEffect(() => {
    (async () =>
      setEngines(await (await fetch(`/api/engines?${querify()}`)).json()))();
  }, []);

  return (
    <>
      <Header
        onSearch={async q => {
          dispatch(undefined);
          const start = Date.now();
          let slowestEngine: string | undefined;
          await Promise.all(
            Object.values(engines).map(async engine => {
              dispatch({
                engineId: engine.id,
                results: await (
                  await fetch(
                    `/api/search?${querify({ engine: engine.id, q })}`,
                  )
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
        }}
      />
      <Sidebar engines={engines} />
      <Results engines={engines} resultGroups={resultGroups} />
    </>
  );
};

ReactDOM.render(React.createElement(App), document.querySelector("#root"));
