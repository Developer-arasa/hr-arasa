export default function Loading({ lines = 4, type = 'skeleton' }) {
  if (type === 'spinner') {
    return (
      <div className="loading">
        <div className="loading__spinner" />
        <span className="loading__text">Memuat data...</span>
      </div>
    );
  }

  return (
    <div className="loading" aria-label="Memuat data">
      <div className="loading__skeleton">
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className="skeleton-line"
            style={{ width: `${[92, 70, 84, 60][i % 4]}%` }}
          />
        ))}
      </div>
    </div>
  );
}
