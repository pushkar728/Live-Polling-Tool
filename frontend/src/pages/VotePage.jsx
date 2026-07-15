import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "../lib/api";

export default function VotePage() {
  const { shareCode } = useParams();
  const [poll, setPoll] = useState(null);
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    api
      .getPoll(shareCode)
      .then(setPoll)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [shareCode]);

  const submit = async (e) => {
    e.preventDefault();
    if (!selected) {
      setError("Pick an option first.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await api.vote(shareCode, selected);
      navigate(`/results/${shareCode}`);
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="container" style={{ paddingTop: 80, textAlign: "center", color: "var(--bone-dim)" }}>
        Loading poll…
      </div>
    );
  }

  if (error && !poll) {
    return (
      <div className="container" style={{ paddingTop: 80, textAlign: "center" }}>
        <p className="error-banner" style={{ display: "inline-block" }}>{error}</p>
      </div>
    );
  }

  if (!poll.isOpen) {
    return (
      <div className="container" style={{ maxWidth: 480, paddingTop: 80, textAlign: "center" }}>
        <h1 style={{ fontSize: 24, marginBottom: 8 }}>This poll is closed</h1>
        <p style={{ color: "var(--bone-dim)", marginBottom: 24 }}>
          The creator has stopped accepting votes, but you can still see the results.
        </p>
        <button className="btn btn-primary" onClick={() => navigate(`/results/${shareCode}`)}>
          View results
        </button>
      </div>
    );
  }

  return (
    <div className="container" style={{ maxWidth: 480, paddingTop: 64 }}>
      <h1 style={{ fontSize: 26, marginBottom: 24, lineHeight: 1.3 }}>{poll.question}</h1>

      <form onSubmit={submit} className="card">
        {error && <div className="error-banner">{error}</div>}

        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 24 }}>
          {poll.options.map((opt) => (
            <label
              key={opt.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "14px 16px",
                borderRadius: 10,
                border: `1px solid ${selected === opt.id ? "var(--signal)" : "var(--ink-border)"}`,
                background: selected === opt.id ? "rgba(62,207,142,0.08)" : "transparent",
                cursor: "pointer",
                transition: "border-color 0.15s ease, background 0.15s ease",
              }}
            >
              <input
                type="radio"
                name="option"
                value={opt.id}
                checked={selected === opt.id}
                onChange={() => setSelected(opt.id)}
                style={{ width: 16, height: 16 }}
              />
              {opt.text}
            </label>
          ))}
        </div>

        <button className="btn btn-primary" type="submit" disabled={submitting} style={{ width: "100%" }}>
          {submitting ? "Casting vote…" : "Vote"}
        </button>
      </form>
    </div>
  );
}
