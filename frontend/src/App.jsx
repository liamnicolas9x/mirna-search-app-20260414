import { useEffect, useState } from "react";
import "./styles.css";
import "./header.css";
import logo from "./assets/logo.png";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

function normalizeQuery(input) {
  const q = input.trim();
  if (/^\d+[a-zA-Z\-0-9]*$/.test(q)) {
    return `miR-${q}`;
  }
  return q;
}

export default function App() {
  const [query, setQuery] = useState("miR-30a");
  const [results, setResults] = useState([]);
  const [originalResults, setOriginalResults] = useState([]); // 👉 lưu bản gốc
  const [loading, setLoading] = useState(false);
  const [familyMode, setFamilyMode] = useState(null);

  useEffect(() => {
    const q = normalizeQuery(query);
    if (!q) return;

    const timeout = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API_URL}/search?q=${q}`);
        const data = await res.json();

        const base = data.results || [];
        setResults(base);
        setOriginalResults(base); // 👉 lưu lại
        setFamilyMode(null);
      } catch (err) {
        console.error("Fetch error:", err);
        setResults([]);
        setOriginalResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timeout);
  }, [query]);

  async function handleFamilyClick(row) {
    const family = row.mir_family;

    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/search?q=${family}`);
      const data = await res.json();

      const all = data.results || [];

      const sameFamily = all.filter(
        (r) => r.mir_family === family
      );

      const final = [
        row,
        ...sameFamily.filter((r) => r.mirbase_id !== row.mirbase_id),
      ];

      setResults(final);
      setFamilyMode({ base: row, family });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  // 👉 BACK BUTTON
  function handleBack() {
    setResults(originalResults);
    setFamilyMode(null);
  }

  return (
    <div className="app">
      {/* HEADER */}
      <header className="header">
        <div className="brand">
          <img src={logo} alt="logo" />
          <h1>HGL microRNA Explorer</h1>
        </div>

        <input
          className="search-input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={(e) => e.target.select()}
          placeholder="Search miRNA..."
        />
      </header>

      {/* MAIN */}
      <div className="layout">
        <div className="table">
          <div className="table-header">
            <h2>
              Results {familyMode && `(Family: ${familyMode.family})`}
            </h2>

            <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
              {familyMode && (
                <button
                  onClick={handleBack}
                  style={{
                    padding: "6px 10px",
                    borderRadius: "6px",
                    border: "1px solid #ccc",
                    cursor: "pointer",
                    background: "#fde68a",
                  }}
                >
                  ← Back
                </button>
              )}

              <span>
                {loading ? "Loading..." : `${results.length} records`}
              </span>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>No.</th>
                <th>miRNA name</th>
                <th>MIMAT</th>
                <th>Sequence 5'-3'</th>
                <th>Length</th>
                <th>Seed</th>
                <th>Family</th>
                <th></th>
              </tr>
            </thead>

            <tbody>
              {results.map((r, i) => (
                <tr key={r.mirbase_id}>
                  <td>{i + 1}</td>
                  <td>{r.mirbase_id}</td>
                  <td>{r.mirbase_accession}</td>
                  <td className="mono">{r.mature_sequence}</td>
                  <td>{r.mature_sequence?.length}</td>
                  <td>{r.seed_m8}</td>
                  <td>{r.mir_family}</td>
                  <td>
                    <button
                      onClick={() => handleFamilyClick(r)}
                      style={{
                        padding: "4px 8px",
                        borderRadius: "6px",
                        border: "1px solid #ccc",
                        cursor: "pointer",
                        background: "#f1f5f9",
                      }}
                    >
                      Family
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* FOOTER */}
      <footer className="footer">
        HGL web-tool. Database based on miRbase v.
      </footer>
    </div>
  );
}
