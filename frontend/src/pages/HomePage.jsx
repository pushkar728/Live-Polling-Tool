import { Link } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";

export default function HomePage() {
  const { user } = useAuth();

  return (
    <div className="container" style={{ paddingTop: 100, textAlign: "center" }}>
      <div style={{ display: "inline-flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
        <span style={{ width: 10, height: 10, borderRadius: "50%", background: "var(--signal)" }} />
        <span className="mono" style={{ fontSize: 13, color: "var(--bone-dim)", letterSpacing: "0.08em" }}>
          LIVE POLLING
        </span>
      </div>
      <h1 style={{ fontSize: 44, lineHeight: 1.15, marginBottom: 16, maxWidth: 560, marginInline: "auto" }}>
        Ask a question.<br />Watch answers arrive.
      </h1>
      <p style={{ color: "var(--bone-dim)", fontSize: 17, maxWidth: 440, margin: "0 auto 32px" }}>
        Create a poll, share the link, and see every vote land in real time — no refresh, no delay.
      </p>
      <Link to={user ? "/create" : "/signup"} className="btn btn-primary" style={{ fontSize: 16, padding: "14px 28px" }}>
        {user ? "Create a poll" : "Get started"}
      </Link>
    </div>
  );
}
