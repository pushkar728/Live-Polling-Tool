import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api } from "../lib/api";

export default function SignupPage() {
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const onChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api.signup(form);
      navigate("/login", { state: { justSignedUp: true } });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container" style={{ maxWidth: 420, paddingTop: 64 }}>
      <h1 style={{ fontSize: 28, marginBottom: 4 }}>Create your account</h1>
      <p style={{ color: "var(--bone-dim)", marginBottom: 28 }}>
        You'll need this to create and manage polls.
      </p>

      <form onSubmit={onSubmit} className="card">
        {error && <div className="error-banner">{error}</div>}

        <div className="field">
          <label htmlFor="name">Name</label>
          <input id="name" name="name" value={form.name} onChange={onChange} required minLength={2} />
        </div>

        <div className="field">
          <label htmlFor="email">Email</label>
          <input id="email" name="email" type="email" value={form.email} onChange={onChange} required />
        </div>

        <div className="field">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            name="password"
            type="password"
            value={form.password}
            onChange={onChange}
            required
            minLength={6}
          />
        </div>

        <button className="btn btn-primary" type="submit" disabled={loading} style={{ width: "100%" }}>
          {loading ? "Creating account…" : "Sign up"}
        </button>
      </form>

      <p style={{ marginTop: 20, color: "var(--bone-dim)", fontSize: 14 }}>
        Already have an account? <Link to="/login" style={{ color: "var(--signal)" }}>Log in</Link>
      </p>
    </div>
  );
}
