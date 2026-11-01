export default function Loading() {
  return (
    <div className="page container" aria-busy="true" aria-label="Loading">
      <div className="skeleton" style={{ height: 48, width: 280, marginBottom: "var(--space-xl)" }} />
      {[0, 1, 2].map((i) => (
        <div key={i} className="release-day">
          <div className="skeleton" style={{ height: 96 }} />
          <div style={{ display: "grid", gap: "var(--space-sm)" }}>
            <div className="skeleton" style={{ height: 90 }} />
            <div className="skeleton" style={{ height: 90 }} />
          </div>
        </div>
      ))}
    </div>
  );
}
