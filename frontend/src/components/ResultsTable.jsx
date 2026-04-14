function highlight(text, query) {
  if (!query) return text;
  const regex = new RegExp(`(${query})`, "gi");
  return text.split(regex).map((part, i) =>
    regex.test(part) ? <mark key={i}>{part}</mark> : part
  );
}

export default function ResultsTable({
  results,
  selected,
  setSelected,
  loading,
  query,
}) {
  return (
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
              className={selected?.mirbase_id === r.mirbase_id ? "active" : ""}
              onClick={() => setSelected(r)}
            >
              <td>{highlight(r.mirbase_id, query)}</td>
              <td className="mono">{r.mature_sequence}</td>
              <td>{r.mir_family}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}