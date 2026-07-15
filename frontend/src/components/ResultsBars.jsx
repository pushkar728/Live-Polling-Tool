// Renders each option as a horizontal bar whose width animates smoothly
// whenever `counts` changes - the CSS transition on `width` is what makes
// incoming votes feel alive rather than a page that silently reflows.
const BAR_COLORS = ["#3ecf8e", "#8b7fd6", "#e8604c", "#f0c96b", "#5aa9e6", "#e68bd0"];

export default function ResultsBars({ options, counts, total }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {options.map((opt, i) => {
        const count = counts[opt.id] || 0;
        const pct = total > 0 ? (count / total) * 100 : 0;
        return (
          <div key={opt.id}>
            <div style={styles.labelRow}>
              <span>{opt.text}</span>
              <span className="mono" style={styles.count}>
                {count} <span style={{ color: "var(--bone-dim)" }}>({pct.toFixed(0)}%)</span>
              </span>
            </div>
            <div style={styles.track}>
              <div
                style={{
                  ...styles.fill,
                  width: `${pct}%`,
                  background: BAR_COLORS[i % BAR_COLORS.length],
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

const styles = {
  labelRow: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: 6,
    fontSize: 15,
  },
  count: {
    fontSize: 14,
  },
  track: {
    height: 10,
    borderRadius: 999,
    background: "var(--ink)",
    border: "1px solid var(--ink-border)",
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    borderRadius: 999,
    transition: "width 0.5s cubic-bezier(0.16, 1, 0.3, 1)",
  },
};
