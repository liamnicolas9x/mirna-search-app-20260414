import { useEffect, useState } from "react";

const API_URL =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.PROD
    ? "https://mirna-search-api-20260414.onrender.com"
    : "http://localhost:8000");
const DEFAULT_COLUMNS = [
  "mirbase_id",
  "mirbase_accession",
  "mature_sequence",
  "seed_m8",
  "mir_family",
];

function formatValue(value) {
  return value === null || value === undefined || value === "" ? "N/A" : value;
}

export default function App() {
  const [query, setQuery] = useState("let");
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setSelected(null);
      setLoading(false);
      setError("");
      return undefined;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(
          `${API_URL}/search?q=${encodeURIComponent(trimmed)}&limit=50`,
          { signal: controller.signal },
        );
        if (!response.ok) {
          throw new Error("Unable to fetch search results.");
        }
        const payload = await response.json();
        setResults(payload.results || []);
        setSelected((current) => {
          if (!current) {
            return payload.results?.[0] || null;
          }
          return payload.results?.find((item) => item.mirbase_id === current.mirbase_id) || null;
        });
      } catch (fetchError) {
        if (fetchError.name !== "AbortError") {
          setResults([]);
          setSelected(null);
          setError(fetchError.message || "Something went wrong.");
        }
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [query]);

  return (
    <div className="page-shell">
      <div className="backdrop" />
      <main className="app-shell">
        <section className="hero">
          <p className="eyebrow">microRNA explorer</p>
          <h1>Search mature sequences, families, and identifiers in one place.</h1>
          <p className="hero-copy">
            Powered by a FastAPI + SQLite backend generated directly from the supplied CSV.
          </p>
          <label className="search-panel">
            <span>Search microRNA records</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Try let, miR-21, or a family name"
            />
          </label>
        </section>

        <section className="content-grid">
          <div className="table-card">
            <div className="table-header">
              <h2>Results</h2>
              <span>{loading ? "Searching..." : `${results.length} shown`}</span>
            </div>

            {error ? <p className="status-message error">{error}</p> : null}
            {!loading && !error && query.trim() && results.length === 0 ? (
              <p className="status-message">No results found</p>
            ) : null}

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    {DEFAULT_COLUMNS.map((column) => (
                      <th key={column}>{column}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {results.map((row) => (
                    <tr
                      key={row.mirbase_id}
                      className={selected?.mirbase_id === row.mirbase_id ? "selected" : ""}
                      onClick={() => setSelected(row)}
                    >
                      {DEFAULT_COLUMNS.map((column) => (
                        <td key={`${row.mirbase_id}-${column}`}>{formatValue(row[column])}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <aside className="detail-card">
            <div className="table-header">
              <h2>Detail</h2>
              <span>{selected?.mirbase_id || "Pick a row"}</span>
            </div>
            {selected ? (
              <dl className="detail-grid">
                {Object.entries(selected).map(([key, value]) => (
                  <div key={key} className="detail-row">
                    <dt>{key}</dt>
                    <dd>{formatValue(value)}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="status-message">Select a result to inspect the full microRNA record.</p>
            )}
          </aside>
        </section>
      </main>
    </div>
  );
}
