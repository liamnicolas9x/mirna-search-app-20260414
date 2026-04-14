import { useEffect, useState } from "react";
import "./styles.css";
import "./header.css";

// nếu chưa có logo thì COMMENT dòng dưới
import logo from "./assets/logo.png";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export default function App() {
  const [query, setQuery] = useState("miR-30a");
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const q = query.trim();
    if (!q) return;

    const timeout = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API_URL}/search?q=${q}`);
        const data = await res.json();
        setResults(data.results || []);
        setSelected(data.results?.[0] || null);
      } catch (err) {
        console.error("Fetch error:", err);
        setResults([]);
        setSelected(null);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timeout);
  }, [query]);

  return (
    <div className="app">
      {/* HEADER */}
      <header className="header">
        <div className="brand">
          {/* nếu lỗi logo → comment dòng này */}
          <img src={logo} alt="logo" />
          <h1>HGL microRNA Explorer</h1>
        </div>

        <input
          className="search-input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search miRNA (let-7...)"
        />
      </header>

      {/* MAIN */}
      <div className="layout">
        {/* TABLE */}
        <div className="table">
          <div className="table-header">
            <h2>Results</h2>
            <span>{loading ? "Loading..." : `${results.length} records`}</span>
          </div>

          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Sequence</th>
                <th>Family</th>
              </tr>
            </thead>

            <tbody>
              {results.map((r) => (
                <tr
                  key={r.mirbase_id}
                  className={
                    selected?.mirbase_id === r.mirbase_id ? "active" : ""
                  }
                  onClick={() => setSelected(r)}
                >
                  <td>{r.mirbase_id}</td>
                  <td className="mono">{r.mature_sequence}</td>
                  <td>{r.mir_family}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* DETAIL */}
        <div className="detail">
          {selected ? (
            <>
              <h2>{selected.mirbase_id}</h2>

              {Object.entries(selected).map(([key, value]) => (
                <div key={key} className="row">
                  <span className="label">{key}</span>
                  <span className="value mono">
                    {value || "N/A"}
                  </span>
                </div>
              ))}
            </>
          ) : (
            <p>No selection</p>
          )}
        </div>
      </div>
    </div>
  );
}