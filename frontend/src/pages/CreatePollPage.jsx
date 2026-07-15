import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../lib/AuthContext";

export default function CreatePollPage() {
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [allowMulti, setAllowMulti] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { token } = useAuth();
  const navigate = useNavigate();

  const updateOption = (i, value) => {
    const next = [...options];
    next[i] = value;
    setOptions(next);
  };

  const addOption = () => {
    if (options.length >= 10) return;
    setOptions([...options, ""]);
  };

  const removeOption = (i) => {
    if (options.length <= 2) return;
    setOptions(options.filter((_, idx) => idx !== i));
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");

    const cleanOptions = options.map((o) => o.trim()).filter(Boolean);
    if (cleanOptions.length < 2) {
      setError("Add at least two options.");
      return;
    }

    setLoading(true);
    try {
      const poll = await api.createPoll(
        { question: question.trim(), options: cleanOptions, allowMulti },
        token
      );
      navigate(`/dashboard`, { state: { createdShareCode: poll.shareCode } });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container" style={{ maxWidth: 560, paddingTop: 56, paddingBottom: 64 }}>
      <h1 style={{ fontSize: 28, marginBottom: 4 }}>New poll</h1>
      <p style={{ color: "var(--bone-dim)", marginBottom: 28 }}>
        Ask a question, share the link, watch votes land live.
      </p>

      <form onSubmit={onSubmit} className="card">
        {error && <div className="error-banner">{error}</div>}

        <div className="field">
          <label htmlFor="question">Question</label>
          <input
            id="question"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="What should we build next?"
            required
            minLength={3}
            maxLength={280}
          />
        </div>

        <div className="field">
          <label>Options</label>
          {options.map((opt, i) => (
            <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <input
                value={opt}
                onChange={(e) => updateOption(i, e.target.value)}
                placeholder={`Option ${i + 1}`}
                required
                maxLength={120}
              />
              {options.length > 2 && (
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => removeOption(i)}
                  style={{ padding: "0 14px" }}
                  aria-label={`Remove option ${i + 1}`}
                >
                  ✕
                </button>
              )}
            </div>
          ))}
          {options.length < 10 && (
            <button type="button" className="btn btn-ghost" onClick={addOption} style={{ marginTop: 4 }}>
              + Add option
            </button>
          )}
        </div>

        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, margin: "20px 0" }}>
          <input
            type="checkbox"
            checked={allowMulti}
            onChange={(e) => setAllowMulti(e.target.checked)}
            style={{ width: 16, height: 16 }}
          />
          Allow voters to pick more than one option
        </label>

        <button className="btn btn-primary" type="submit" disabled={loading} style={{ width: "100%" }}>
          {loading ? "Creating…" : "Create poll"}
        </button>
      </form>
    </div>
  );
}
