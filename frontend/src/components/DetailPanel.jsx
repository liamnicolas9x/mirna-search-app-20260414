export default function DetailPanel({ selected }) {
  if (!selected) {
    return <div className="detail">No selection</div>;
  }

  return (
    <div className="detail">
      <h2>{selected.mirbase_id}</h2>

      {Object.entries(selected).map(([key, value]) => (
        <div key={key} className="row">
          <span className="label">{key}</span>
          <span className="value mono">{value || "N/A"}</span>
        </div>
      ))}
    </div>
  );
}