import { useEffect, useState, useRef } from "react";
import "./styles.css";
import "./header.css";
import logo from "./assets/logo.png";
import defaultData from "./data/default.json";
import lightDB from "./data/light_db.json";
import guide from "./data/guide.json";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

function normalizeQuery(input) {
  const q = input.trim();
  if (/^\d+[a-zA-Z\-0-9]*$/.test(q)) {
    return `miR-${q}`;
  }
  return q;
}

function isRNATail(input) {
  const seq = input.toUpperCase();
  return /^[AUGC]+$/.test(seq) && seq.length >= 5;
}

function getSeedPos(seq, seed) {
  if (!seq || !seed) return null;
  const s = seq.toUpperCase();
  const sd = seed.toUpperCase();
  const i = s.indexOf(sd);
  if (i === -1) return null;
  return [i + 1, i + sd.length];
}

function renderSeq(seq, seed, tail, showSeed, showColor) {
  if (!seq) return seq;

  const upper = seq.toUpperCase();
  const tailUpper = tail?.toUpperCase();

  return seq.split("").map((c, i) => {
    let cls = "";

    if (showColor) {
      if (c === "A") cls += " base-a";
      else if (c === "U") cls += " base-u";
      else if (c === "G") cls += " base-g";
      else if (c === "C") cls += " base-c";
    }

    if (showSeed && seed) {
      const idx = upper.indexOf(seed.toUpperCase());
      if (idx !== -1 && i >= idx && i < idx + seed.length) {
        cls += " seed-highlight";
      }
    }

    if (tailUpper && upper.endsWith(tailUpper)) {
      const start = upper.length - tailUpper.length;
      if (i >= start) cls += " tail-highlight";
    }

    return (
      <span key={i} className={cls.trim()}>
        {c}
      </span>
    );
  });
}

export default function App() {
  const inputRef = useRef(null);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState(defaultData);
  const [originalResults, setOriginalResults] = useState(defaultData);

  const [loading, setLoading] = useState(false);
  const [familyMode, setFamilyMode] = useState(null);
  const [toast, setToast] = useState("");

  const [showSeed, setShowSeed] = useState(true);
  const [showColor, setShowColor] = useState(true);
  const [tailMode, setTailMode] = useState(false);

  // ===== HYBRID STATE =====
  const [backendReady, setBackendReady] = useState(false);
  const [useLocal, setUseLocal] = useState(true);

  // ===== CACHE =====
  const cacheRef = useRef({});

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, []);

  // wake backend + detect ready
  useEffect(() => {
    let alive = true;

    const check = async () => {
      try {
        await fetch(`${API_URL}/health`);
        if (alive) {
          setBackendReady(true);
          setUseLocal(false);
        }
      } catch {}
    };

    const interval = setInterval(check, 3000);
    check();

    return () => {
      alive = false;
      clearInterval(interval);
    };
  }, []);

  // preload backend
  useEffect(() => {
    if (!backendReady) return;

    fetch(`${API_URL}/search?q=miR`)
      .then((res) => res.json())
      .then((data) => {
        if (data.results?.length) {
          cacheRef.current["mir"] = data.results;
        }
      })
      .catch(() => {});
  }, [backendReady]);

  // ===== LOCAL SEARCH =====
  function localSearch(data, query) {
    const q = query.toLowerCase();

    return data
      .map((r) => {
        let rank = 5;

        if (r.mirbase_id?.toLowerCase().includes(q)) rank = 0;
        else if (r.mirbase_accession?.toLowerCase().includes(q)) rank = 1;
        else if (r.mature_sequence?.toLowerCase().includes(q)) rank = 2;
        else if (r.seed_m8?.toLowerCase().includes(q)) rank = 3;
        else if (r.mir_family?.toLowerCase().includes(q)) rank = 4;

        return { ...r, rank };
      })
      .filter((r) => r.rank < 5)
      .sort((a, b) => a.rank - b.rank);
  }

  // ===== SEARCH =====
  useEffect(() => {
    const raw = query.trim();
    if (!raw) return;

    const isTail = isRNATail(raw);
    setTailMode(isTail);

    const q = isTail ? raw.toUpperCase() : normalizeQuery(raw);

    const t = setTimeout(async () => {
      setLoading(true);

      try {
        // LOCAL FIRST
        if (useLocal) {
          let base = localSearch(lightDB, q);

          if (isTail) {
            base = base.filter((r) =>
              r.mature_sequence?.toUpperCase().endsWith(q)
            );
          }

          setResults(base);
          setOriginalResults(base);

          if (backendReady) {
            if (cacheRef.current[q]) {
              setResults(cacheRef.current[q]);
              setOriginalResults(cacheRef.current[q]);
            } else {
              const res = await fetch(`${API_URL}/search?q=${q}`);
              const data = await res.json();

              cacheRef.current[q] = data.results || [];

              setResults(cacheRef.current[q]);
              setOriginalResults(cacheRef.current[q]);
            }
          }

          return;
        }

        // BACKEND + CACHE
        if (cacheRef.current[q]) {
          setResults(cacheRef.current[q]);
          setOriginalResults(cacheRef.current[q]);
          return;
        }

        const res = await fetch(`${API_URL}/search?q=${q}`);
        const data = await res.json();

        let base = data.results || [];

        if (isTail) {
          base = base.filter((r) =>
            r.mature_sequence?.toUpperCase().endsWith(q)
          );
        }

        cacheRef.current[q] = base;

        setResults(base);
        setOriginalResults(base);
        setFamilyMode(null);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 150);

    return () => clearTimeout(t);
  }, [query, useLocal, backendReady]);

  async function handleFamilyClick(row) {
    const family = row.mir_family;

    if (cacheRef.current[family]) {
      setResults(cacheRef.current[family]);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/search?q=${family}`);
      const data = await res.json();

      const same = (data.results || []).filter(
        (r) => r.mir_family === family
      );

      const final = [
        row,
        ...same.filter((r) => r.mirbase_id !== row.mirbase_id),
      ];

      cacheRef.current[family] = final;

      setResults(final);
      setFamilyMode({ family });
    } finally {
      setLoading(false);
    }
  }

  function handleBack() {
    setResults(originalResults);
    setFamilyMode(null);
  }

  function copySequence(seq) {
    navigator.clipboard.writeText(seq);
    setToast("Copied!");
    setTimeout(() => setToast(""), 1200);
  }

  function handleHome() {
    setQuery("");
    setResults(defaultData);
    setOriginalResults(defaultData);
    setFamilyMode(null);
    setTailMode(false);

    if (inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }

  return (
    <div className="app">
      <header className="header">
        <div className="brand" onClick={handleHome}>
          <img src={logo} alt="logo" />
          <h1>HGL microRNA Explorer</h1>
        </div>

        <input
          ref={inputRef}
          className="search-input"
          placeholder="Search miRNA or tail sequence..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={(e) => e.target.select()}
        />
      </header>

      <div className="layout">
        <div className="table">
          <div className="table-header">
            <h2>
              Results {tailMode && "(Tail search)"}{" "}
              {familyMode && `(Family: ${familyMode.family})`}
            </h2>

            <div style={{ display: "flex", gap: "10px" }}>
              <button onClick={() => setShowSeed(!showSeed)}>
                {showSeed ? "Hide Seed" : "Show Seed"}
              </button>

              <button onClick={() => setShowColor(!showColor)}>
                {showColor ? "Hide Color" : "Show Color"}
              </button>

              {familyMode && (
                <button onClick={handleBack}>← Back</button>
              )}

              <span>
                {useLocal
                  ? "⚡ Fast (local)"
                  : loading
                  ? "Loading..."
                  : `${results.length} records`}
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
              {results.map((r, i) => {
                const seedPos = getSeedPos(
                  r.mature_sequence,
                  r.seed_m8
                );

                return (
                  <tr key={r.mirbase_id}>
                    <td>{i + 1}</td>
                    <td>{r.mirbase_id}</td>
                    <td className="mimat">{r.mirbase_accession}</td>

                    <td
                      className="sequence"
                      onClick={() => copySequence(r.mature_sequence)}
                    >
                      {renderSeq(
                        r.mature_sequence,
                        r.seed_m8,
                        tailMode ? query : null,
                        showSeed,
                        showColor
                      )}
                    </td>

                    <td>{r.mature_sequence?.length}</td>

                    <td className="seed">
                      {r.seed_m8}
                      {seedPos && (
                        <span className="pos">
                          ({seedPos[0]}–{seedPos[1]})
                        </span>
                      )}
                    </td>

                    <td>{r.mir_family}</td>

                    <td>
                      <button onClick={() => handleFamilyClick(r)}>
                        Family
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {toast && <div className="toast">{toast}</div>}

      <div className="guide">
        <h2>{guide.title}</h2>
        <div className="guide-content">
          {guide.sections.map((s, i) => (
            <div key={i} className="guide-item">
              <h3>{s.title}</h3>
              <p>{s.content}</p>
            </div>
          ))}
        </div>
      </div>

      <footer className="footer">
        <div>HGL web-tool. Database based on miRBase and TargetScan v8.0</div>
        <div>
          Contact:{" "}
          <a
            href="https://hglab.hcmus.edu.vn"
            target="_blank"
            rel="noopener noreferrer"
          >
            https://hglab.hcmus.edu.vn
          </a>
        </div>
      </footer>
    </div>
  );
}