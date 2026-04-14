export default function SearchBar({ query, setQuery }) {
  return (
    <input
      className="search-input"
      value={query}
      onChange={(e) => setQuery(e.target.value)}
      placeholder="Search miRNA (let-7, sequence...)"
    />
  );
}