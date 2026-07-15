import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { api, wsUrl } from "../lib/api";
import ResultsBars from "../components/ResultsBars";
import LiveBadge from "../components/LiveBadge";

// This is the payoff of the whole project: connect a WebSocket to the
// backend's /watch endpoint, and every time someone (anywhere) votes on
// this poll, the backend pushes fresh counts down the socket and this
// component just re-renders. No polling, no refresh button.
export default function ResultsPage() {
  const { shareCode } = useParams();
  const [results, setResults] = useState(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState("");
  const socketRef = useRef(null);

  useEffect(() => {
    // Fetch an initial snapshot via plain REST so the page has something
    // to show immediately, before the socket even finishes connecting.
    api
      .getResults(shareCode)
      .then(setResults)
      .catch((err) => setError(err.message));

    const socket = new WebSocket(wsUrl(shareCode));
    socketRef.current = socket;

    socket.onopen = () => setConnected(true);
    socket.onclose = () => setConnected(false);
    socket.onerror = () => setConnected(false);

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setResults(data);
      } catch {
        // ignore malformed frames
      }
    };

    return () => socket.close();
  }, [shareCode]);

  if (error && !results) {
    return (
      <div className="container" style={{ paddingTop: 80, textAlign: "center" }}>
        <p className="error-banner" style={{ display: "inline-block" }}>{error}</p>
      </div>
    );
  }

  if (!results) {
    return (
      <div className="container" style={{ paddingTop: 80, textAlign: "center", color: "var(--bone-dim)" }}>
        Loading results…
      </div>
    );
  }

  const shareLink = `${window.location.origin}/vote/${shareCode}`;

  return (
    <div className="container" style={{ maxWidth: 640, paddingTop: 56, paddingBottom: 64 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <LiveBadge isOpen={results.isOpen} />
        <span className="mono" style={{ fontSize: 12, color: connected ? "var(--signal)" : "var(--bone-dim)" }}>
          {connected ? "● connected" : "○ reconnecting…"}
        </span>
      </div>

      <h1 style={{ fontSize: 28, margin: "12px 0 6px", lineHeight: 1.3 }}>{results.question}</h1>
      <p className="mono" style={{ color: "var(--bone-dim)", fontSize: 14, marginBottom: 28 }}>
        {results.totalVotes} vote{results.totalVotes === 1 ? "" : "s"}
      </p>

      <div className="card">
        <ResultsBars options={results.options} counts={results.counts} total={results.totalVotes} />
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 20 }}>
        <input readOnly value={shareLink} style={inputStyle} onFocus={(e) => e.target.select()} />
        <button
          className="btn btn-ghost"
          onClick={() => navigator.clipboard.writeText(shareLink)}
          style={{ flexShrink: 0 }}
        >
          Copy
        </button>
      </div>
    </div>
  );
}

const inputStyle = {
  flex: 1,
  background: "var(--ink-raised)",
  border: "1px solid var(--ink-border)",
  borderRadius: 10,
  color: "var(--bone-dim)",
  padding: "10px 14px",
  fontFamily: "var(--font-mono)",
  fontSize: 13,
};
