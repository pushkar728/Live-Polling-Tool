import { Link } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";

export default function Navbar() {
  const { user, logout } = useAuth();

  return (
    <header style={styles.header}>
      <div className="container" style={styles.row}>
        <Link to="/" style={styles.brand}>
          <span style={styles.dot} />
          Pulse
        </Link>
        <nav style={styles.nav}>
          {user ? (
            <>
              <Link to="/dashboard" style={styles.link}>
                Dashboard
              </Link>
              <Link to="/create" className="btn btn-primary" style={{ padding: "8px 16px" }}>
                New poll
              </Link>
              <button className="btn btn-ghost" style={{ padding: "8px 16px" }} onClick={logout}>
                Log out
              </button>
            </>
          ) : (
            <>
              <Link to="/login" style={styles.link}>
                Log in
              </Link>
              <Link to="/signup" className="btn btn-primary" style={{ padding: "8px 16px" }}>
                Sign up
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}

const styles = {
  header: {
    borderBottom: "1px solid var(--ink-border)",
    padding: "18px 0",
  },
  row: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  brand: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontWeight: 700,
    fontSize: 20,
    textDecoration: "none",
    color: "var(--bone)",
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: "50%",
    background: "var(--signal)",
    boxShadow: "0 0 0 3px rgba(62,207,142,0.2)",
  },
  nav: {
    display: "flex",
    alignItems: "center",
    gap: 16,
  },
  link: {
    textDecoration: "none",
    fontSize: 15,
    color: "var(--bone-dim)",
  },
};
