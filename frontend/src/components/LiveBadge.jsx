export default function LiveBadge({ isOpen }) {
  return (
    <span style={styles.badge(isOpen)}>
      <span style={styles.dot(isOpen)} />
      {isOpen ? "LIVE" : "CLOSED"}
    </span>
  );
}

const styles = {
  badge: (isOpen) => ({
    display: "inline-flex",
    alignItems: "center",
    gap: 7,
    fontFamily: "var(--font-mono)",
    fontSize: 12,
    letterSpacing: "0.08em",
    padding: "5px 10px 5px 8px",
    borderRadius: 999,
    color: isOpen ? "var(--signal)" : "var(--bone-dim)",
    border: `1px solid ${isOpen ? "rgba(62,207,142,0.35)" : "var(--ink-border)"}`,
    background: isOpen ? "rgba(62,207,142,0.08)" : "transparent",
  }),
  dot: (isOpen) => ({
    width: 7,
    height: 7,
    borderRadius: "50%",
    background: isOpen ? "var(--signal)" : "var(--bone-dim)",
    animation: isOpen ? "pulse 1.6s ease-in-out infinite" : "none",
  }),
};

// Inject the keyframes once, globally - simplest way to do this without
// a CSS file per-component in a small app like this.
if (typeof document !== "undefined" && !document.getElementById("pulse-keyframes")) {
  const style = document.createElement("style");
  style.id = "pulse-keyframes";
  style.textContent = `
    @keyframes pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.4; transform: scale(1.3); }
    }
  `;
  document.head.appendChild(style);
}
