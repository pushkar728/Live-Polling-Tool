import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../lib/AuthContext";
import LiveBadge from "../components/LiveBadge";

export default function DashboardPage() {
  const [polls, setPolls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copiedCode, setCopiedCode] = useState("");
  const { token } = useAuth();
  const location = useLocation();

  const load = async () => {
    setLoading(true);
    try {
      const data = await api.myPolls(token);
      setPolls(data.sort((a, b) => b.createdAt - a.createdAt));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const copyLink = (shareCode) => {
    const link = `${window.location.origin}/vote/${shareCode}`;
    navigator.clipboard.writeText(link);
    setCopiedCode(shareCode);
    setTimeout(() => setCopiedCode(""), 1800);
  };

  const closePoll = async (id) => {
    try {
      await api.closePoll(id, token);
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="container" style={{ paddingTop: 56, paddingBottom: 64 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 28, marginBottom: 4 }}>Your polls</h1>
          <p style={{ color: "var(--bone-dim)" }}>
            {location.state?.createdShareCode
              ? "Poll created — share the link below to start collecting votes."
              : "Everything you've created, in one place."}
          </p>
        </div>
        <Link to="/create" className="btn btn-primary">
          + New poll
        </Link>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {loading ? (
        <p style={{ color: "var(--bone-dim)" }}>Loading…</p>
      ) : polls.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: 48 }}>
          <p style={{ marginBottom: 16 }}>No polls yet.</p>
          <Link to="/create" className="btn btn-primary">
            Create your first poll
          </Link>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {polls.map((poll) => (
            <div key={poll.id} className="card" style={{ padding: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                    <LiveBadge isOpen={poll.isOpen} />
                  </div>
                  <h3 style={{ margin: 0, fontSize: 18 }}>{poll.question}</h3>
                  <p className="mono" style={{ color: "var(--bone-dim)", fontSize: 13, marginTop: 6 }}>
                    /vote/{poll.shareCode}
                  </p>
                </div>
                <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                  <Link to={`/results/${poll.shareCode}`} className="btn btn-ghost" style={{ padding: "8px 14px", fontSize: 13 }}>
                    View live
                  </Link>
                  <button
                    className="btn btn-ghost"
                    style={{ padding: "8px 14px", fontSize: 13 }}
                    onClick={() => copyLink(poll.shareCode)}
                  >
                    {copiedCode === poll.shareCode ? "Copied!" : "Copy link"}
                  </button>
                  {poll.isOpen && (
                    <button
                      className="btn btn-danger"
                      style={{ padding: "8px 14px", fontSize: 13 }}
                      onClick={() => closePoll(poll.id)}
                    >
                      Close
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
