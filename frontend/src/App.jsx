import { useEffect, useState } from "react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";
const RESULT_COLUMNS = [
  { key: "mirbase_id", label: "miRNA ID" },
  { key: "mature_sequence", label: "Sequence" },
  { key: "mir_family", label: "Description" },
];

function formatValue(value) {
  return value === null || value === undefined || value === "" ? "N/A" : value;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function HighlightedValue({ value, query }) {
  const formatted = String(formatValue(value));
  const trimmedQuery = query.trim();

  if (!trimmedQuery || formatted === "N/A") {
    return formatted;
  }

  const regex = new RegExp(`(${escapeRegExp(trimmedQuery)})`, "ig");
  const parts = formatted.split(regex);

  return parts.map((part, index) =>
    index % 2 === 1 ? (
      <mark key={`${part}-${index}`}>{part}</mark>
    ) : (
      <span key={`${part}-${index}`}>{part}</span>
    ),
  );
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
      <main className="app-shell">
        <section className="hero">
          <p className="eyebrow">microRNA Search Interface</p>
          <h1>Research-oriented lookup for curated microRNA records</h1>
          <p className="hero-copy">
            Search identifiers, mature sequences, and family annotations from a CSV-derived
            reference dataset.
          </p>
          <label className="search-panel" htmlFor="mirna-search">
            <span>Query dataset</span>
            <input
              id="mirna-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search miRNA (e.g. let-7)"
            />
          </label>
        </section>

        <section className="content-grid">
          <div className="table-card">
            <div className="table-header">
              <div>
                <h2>Search Results</h2>
                <p className="table-subtitle">Matched records from the microRNA reference table</p>
              </div>
              <span>{loading ? "Searching..." : `${results.length} records`}</span>
            </div>

            {loading ? (
              <div className="loading-state" aria-live="polite">
                <div className="spinner" />
                <span>Loading matching records...</span>
              </div>
            ) : null}
            {error ? <p className="status-message error">{error}</p> : null}
            {!loading && !error && query.trim() && results.length === 0 ? (
              <p className="status-message">No results found</p>
            ) : null}

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    {RESULT_COLUMNS.map((column) => (
                      <th key={column.key}>{column.label}</th>
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
                      {RESULT_COLUMNS.map((column) => (
                        <td key={`${row.mirbase_id}-${column.key}`}>
                          <HighlightedValue value={row[column.key]} query={query} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <aside className="detail-card">
            <div className="table-header">
              <div>
                <h2>Record Detail</h2>
                <p className="table-subtitle">Structured view of the selected microRNA entry</p>
              </div>
              <span>{selected?.mirbase_id || "No selection"}</span>
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
