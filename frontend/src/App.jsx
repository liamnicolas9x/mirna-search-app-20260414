import { useEffect, useState, useRef } from "react";
import "./styles.css";
import "./header.css";
import logo from "./assets/logo.png";
import defaultData from "./data/default.json";
import lightDB from "./data/light_db.json";
import guide from "./data/guide.json";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";
const SNP_DATA_URL = `${API_URL}/snp-in-mature`;
const snpDataCache = {
  data: null,
  promise: null,
};

function loadSnpDataFromBackend() {
  if (snpDataCache.data) {
    return Promise.resolve(snpDataCache.data);
  }

  snpDataCache.promise =
    snpDataCache.promise ||
    fetch(SNP_DATA_URL)
      .then((res) => {
        if (!res.ok) throw new Error("Unable to load SNP data");
        return res.json();
      })
      .then((data) => {
        snpDataCache.data = data.results || {};
        return snpDataCache.data;
      });

  return snpDataCache.promise;
}

function getRoute() {
  const match = window.location.pathname.match(/^\/mirna\/(.+)$/);
  if (!match) return { name: "home" };

  return {
    name: "mirna-detail",
    mirnaId: decodeURIComponent(match[1]),
  };
}

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

function InfoItem({ label, value }) {
  return (
    <div className="info-item">
      <span>{label}</span>
      <strong>{value || "-"}</strong>
    </div>
  );
}

function ModulePlaceholder({ title, description }) {
  return (
    <section className="detail-module detail-module-placeholder">
      <h3>{title}</h3>
      <p>{description}</p>
    </section>
  );
}

function formatVariant(snp) {
  const ref = snp.ref || "?";
  const alt = snp.alt || "?";
  return `${ref}>${alt}`;
}

function SnpsInMatureModule({ record, snpLookup, snpLoadError }) {
  const sequence = record.mature_sequence || "";
  const bases = sequence.split("");
  const snpIsLoading = !snpLookup && !snpLoadError;
  const snps = snpLookup?.[record.mirbase_id] || [];
  const validSnps = snps
    .filter((snp) => snp.pos_in_mature >= 1 && snp.pos_in_mature <= bases.length)
    .map((snp, index) => ({
      ...snp,
      displayIndex: index + 1,
      label: `SNP${index + 1}: ${snp.snp_id} (${formatVariant(snp)})`,
    }));
  const snpsByPos = validSnps.reduce((acc, snp) => {
    const key = snp.pos_in_mature;
    acc[key] = acc[key] || [];
    acc[key].push(snp);
    return acc;
  }, {});
  const gridStyle = {
    gridTemplateColumns: `repeat(${Math.max(bases.length, 1)}, minmax(34px, 1fr))`,
  };

  return (
    <section className="detail-card snp-module">
      <div className="detail-section-header">
        <div>
          <h3>SNP in mature {record.mirbase_id}</h3>
        </div>
        <span className="snp-count">
          {snpIsLoading ? "Loading SNPs..." : `${validSnps.length} SNPs`}
        </span>
      </div>

      {snpLoadError && <p className="snp-empty">{snpLoadError}</p>}

      {bases.length === 0 ? (
        <p className="snp-empty">No mature sequence available.</p>
      ) : (
        <>
          <div className="snp-visual-wrap">
            <div className="snp-sequence-wrap">
              <div className="strand-label strand-start">5'</div>
              <div className="snp-grid-area">
                <div className="snp-grid position-row" style={gridStyle}>
                  {bases.map((_, index) => (
                    <div key={index + 1} className="snp-cell snp-position">
                      {index + 1}
                    </div>
                  ))}
                </div>

                <div className="snp-grid base-row" style={gridStyle}>
                  {bases.map((base, index) => {
                    const pos = index + 1;
                    const hasSnp = Boolean(snpsByPos[pos]);

                    return (
                      <div
                        key={`${base}-${pos}`}
                        className={`snp-cell snp-base ${hasSnp ? "has-snp" : ""}`}
                      >
                        {base}
                      </div>
                    );
                  })}
                </div>

                <div className="snp-grid marker-row" style={gridStyle}>
                  {bases.map((_, index) => {
                    const pos = index + 1;

                    return (
                      <div key={pos} className="snp-marker-cell">
                        {(snpsByPos[pos] || []).map((snp) => (
                          <span
                            key={`${snp.snp_id}-${snp.alt}-${snp.displayIndex}`}
                            className="snp-marker"
                            data-tooltip={snp.label}
                          >
                            <button
                              className="snp-triangle"
                              title={snp.label}
                              type="button"
                            >
                              <span>{snp.displayIndex}</span>
                            </button>
                          </span>
                        ))}
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="strand-label strand-end">3'</div>
            </div>
          </div>

          {snpIsLoading ? (
            <p className="snp-empty">Loading SNP database...</p>
          ) : validSnps.length > 0 ? (
            <ol className="snp-list">
              {validSnps.map((snp) => (
                <li key={`${snp.snp_id}-${snp.alt}-${snp.displayIndex}`}>
                  <strong>SNP {snp.displayIndex}:</strong>{" "}
                  <a
                    href={`https://www.ncbi.nlm.nih.gov/snp/${snp.snp_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {snp.snp_id}
                  </a>{" "}
                  (
                  {formatVariant(snp)}){" "}
                  <span>
                    position {snp.pos_in_mature}
                    {snp.functional_region
                      ? `, ${snp.functional_region}`
                      : ""}
                    {snp.chr && snp.position
                      ? `, ${snp.chr}:${snp.position}`
                      : ""}
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="snp-empty">
              No SNPs mapped to this mature miRNA in the SNP database.
            </p>
          )}
        </>
      )}
    </section>
  );
}

function MirnaDetailPage({
  mirnaId,
  onNavigateHome,
  onNavigateToMirna,
  snpLookup,
  snpLoadError,
}) {
  const [record, setRecord] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(true);
  const [error, setError] = useState("");
  const [sequenceCopied, setSequenceCopied] = useState(false);

  useEffect(() => {
    let alive = true;

    async function loadDetail() {
      setLoadingDetail(true);
      setError("");

      const localRecord = lightDB.find(
        (item) => item.mirbase_id?.toLowerCase() === mirnaId.toLowerCase()
      );

      try {
        const res = await fetch(
          `${API_URL}/mirna/${encodeURIComponent(mirnaId)}`
        );

        if (!res.ok) {
          throw new Error("microRNA not found");
        }

        const data = await res.json();
        if (alive) setRecord(data);
      } catch {
        if (alive) {
          if (localRecord) {
            setRecord(localRecord);
          } else {
            setRecord(null);
            setError("microRNA not found.");
          }
        }
      } finally {
        if (alive) setLoadingDetail(false);
      }
    }

    loadDetail();

    return () => {
      alive = false;
    };
  }, [mirnaId]);

  const seedPos = record
    ? getSeedPos(record.mature_sequence, record.seed_m8)
    : null;
  const familyAnnotations = record
    ? ["fa1", "fa2", "fa3", "fa4", "fa5", "fa6", "fa7"]
        .map((key) => record[key])
        .filter(Boolean)
    : [];

  async function copyDetailSequence() {
    if (!record?.mature_sequence) return;

    await navigator.clipboard.writeText(record.mature_sequence);
    setSequenceCopied(true);
    setTimeout(() => setSequenceCopied(false), 1200);
  }

  return (
    <main className="detail-page">
      <button className="back-link" onClick={onNavigateHome}>
        Back to search
      </button>

      {loadingDetail && <div className="detail-card">Loading...</div>}

      {!loadingDetail && error && (
        <section className="detail-card detail-empty">
          <h2>{mirnaId}</h2>
          <p>{error}</p>
        </section>
      )}

      {!loadingDetail && record && (
        <>
          <section className="detail-hero">
            <div className="detail-title-block">
              <p className="detail-kicker">microRNA detail</p>
              <h2>{record.mirbase_id}</h2>
            </div>
            <div className="detail-hero-meta">
              <div className="detail-sequence-block detail-hero-sequence">
                <div className="detail-sequence-heading">
                  <span>Sequence 5'-3'</span>
                  {sequenceCopied && <em>Copied</em>}
                </div>
                <div className="sequence detail-sequence">
                  <button
                    className="detail-sequence-copy"
                    onClick={copyDetailSequence}
                    type="button"
                  >
                    {renderSeq(
                      record.mature_sequence,
                      record.seed_m8,
                      null,
                      true,
                      true
                    )}
                  </button>
                </div>
                {seedPos && (
                  <small>
                    Seed position: {seedPos[0]}-{seedPos[1]}
                  </small>
                )}
              </div>
              <div className="info-item detail-hero-accession">
                <span>MiRBase accession</span>
                <strong>
                  {record.mirbase_accession ? (
                    <a
                      href={`https://www.mirbase.org/mature/${record.mirbase_accession}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {record.mirbase_accession}
                    </a>
                  ) : (
                    "-"
                  )}
                </strong>
              </div>
            </div>
          </section>

          <section className="detail-card">
            <div className="info-grid info-grid-compact">
              <InfoItem
                label="Sequence length"
                value={record.mature_sequence?.length}
              />
              <InfoItem label="Seed + m8" value={record.seed_m8} />
              <InfoItem
                label="Family conservation"
                value={record.family_conservation}
              />
              <InfoItem label="miR family" value={record.mir_family} />
            </div>

            <div className="detail-family-block">
              <span>Family miRNA</span>
              {familyAnnotations.length > 0 ? (
                <div className="family-tags">
                  {familyAnnotations.map((item) => (
                    <button
                      key={item}
                      onClick={() => onNavigateToMirna(item)}
                      type="button"
                    >
                      {item}
                    </button>
                  ))}
                </div>
              ) : (
                <p>No family annotation fields available.</p>
              )}
            </div>
          </section>

          <SnpsInMatureModule
            record={record}
            snpLookup={snpLookup}
            snpLoadError={snpLoadError}
          />

          <section className="detail-modules">
            <ModulePlaceholder
              title="Primer design"
              description="Reserved module for primer design workflow."
            />
            <ModulePlaceholder
              title="Target analysis"
              description="Reserved module for target prediction and annotation."
            />
            <ModulePlaceholder
              title="Functional notes"
              description="Reserved module for curated notes, references, or lab-specific data."
            />
          </section>
        </>
      )}
    </main>
  );
}

export default function App() {
  const inputRef = useRef(null);
  const [route, setRoute] = useState(getRoute);

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
  const [snpLookup, setSnpLookup] = useState(snpDataCache.data);
  const [snpLoadError, setSnpLoadError] = useState("");

  // ===== CACHE =====
  const cacheRef = useRef({});

  useEffect(() => {
    const onPopState = () => setRoute(getRoute());
    window.addEventListener("popstate", onPopState);

    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, [route.name]);

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

    loadSnpDataFromBackend()
      .then((data) => {
        setSnpLookup(data);
        setSnpLoadError("");
      })
      .catch(() => {
        setSnpLoadError("Unable to load SNP database from backend.");
      });
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
    if (!family) return;

    if (cacheRef.current[family]) {
      setResults(cacheRef.current[family]);
      setFamilyMode({ family });
      return;
    }

    const localSame = lightDB.filter((r) => r.mir_family === family);
    const localFinal = [
      row,
      ...localSame.filter((r) => r.mirbase_id !== row.mirbase_id),
    ];

    cacheRef.current[family] = localFinal;
    setResults(localFinal);
    setFamilyMode({ family });

    if (!backendReady) return;

    setLoading(true);
    try {
      const res = await fetch(
        `${API_URL}/search?q=${encodeURIComponent(family)}&limit=100`
      );
      const data = await res.json();

      const same = (data.results || []).filter((r) => r.mir_family === family);
      const merged = new Map(
        localFinal.map((item) => [item.mirbase_id, item])
      );

      same.forEach((item) => merged.set(item.mirbase_id, item));

      const final = [
        row,
        ...Array.from(merged.values()).filter(
          (r) => r.mirbase_id !== row.mirbase_id
        ),
      ];

      cacheRef.current[family] = final;
      setResults(final);
    } catch {
      cacheRef.current[family] = localFinal;
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
    window.history.pushState({}, "", "/");
    setRoute({ name: "home" });
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

  function handleSearchChange(value) {
    if (route.name !== "home") {
      window.history.pushState({}, "", "/");
      setRoute({ name: "home" });
    }

    setQuery(value);
  }

  function handleSearchKeyDown(e) {
    if (e.key !== "Enter") return;

    const raw = e.currentTarget.value.trim();
    if (!raw) return;

    if (route.name !== "home") {
      window.history.pushState({}, "", "/");
      setRoute({ name: "home" });
    }
  }

  function navigateToMirna(mirnaId) {
    window.history.pushState(
      {},
      "",
      `/mirna/${encodeURIComponent(mirnaId)}`
    );
    setRoute({ name: "mirna-detail", mirnaId });
  }

  if (route.name === "mirna-detail") {
    return (
      <div className="app">
        <header className="header">
          <div
            className="brand"
            style={{ cursor: "pointer" }}
            onClick={() => (window.location.href = "https://hgltools.vercel.app")}
          >
            <img src={logo} alt="logo" />
            <h1>HGL microRNA Explorer</h1>
          </div>

          <input
            ref={inputRef}
            className="search-input"
            placeholder="Search miRNA or tail sequence..."
            value={query}
            onChange={(e) => handleSearchChange(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            onFocus={(e) => e.target.select()}
          />
        </header>

        <MirnaDetailPage
          mirnaId={route.mirnaId}
          onNavigateHome={handleHome}
          onNavigateToMirna={navigateToMirna}
          snpLookup={snpLookup}
          snpLoadError={snpLoadError}
        />

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

  return (
    <div className="app">
      <header className="header">
        <div
          className="brand"
          style={{ cursor: "pointer" }}
          onClick={() => (window.location.href = "https://hgltools.vercel.app")}
        >
          <img src={logo} alt="logo" />
          <h1>HGL microRNA Explorer</h1>
        </div>

        <input
          ref={inputRef}
          className="search-input"
          placeholder="Search miRNA or tail sequence..."
          value={query}
          onChange={(e) => handleSearchChange(e.target.value)}
          onKeyDown={handleSearchKeyDown}
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
                    <td>
                      <a
                        className="mirna-link"
                        href={`/mirna/${encodeURIComponent(r.mirbase_id)}`}
                        onClick={(e) => {
                          e.preventDefault();
                          navigateToMirna(r.mirbase_id);
                        }}
                      >
                        {r.mirbase_id}
                      </a>
                    </td>
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
