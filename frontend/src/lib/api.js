// Small fetch wrapper so every page doesn't repeat the same boilerplate
// (base URL, JSON headers, error parsing, attaching the auth token).
const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8080/api";

async function request(path, { method = "GET", body, token } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    // The backend always returns { error: "..." } on failure - surface
    // that message directly instead of a generic "request failed".
    throw new Error(data.error || `Request failed (${res.status})`);
  }

  return data;
}

export const api = {
  signup: (payload) => request("/auth/signup", { method: "POST", body: payload }),
  login: (payload) => request("/auth/login", { method: "POST", body: payload }),

  createPoll: (payload, token) =>
    request("/polls", { method: "POST", body: payload, token }),
  myPolls: (token) => request("/my-polls", { token }),
  closePoll: (id, token) =>
    request(`/polls/${id}/close`, { method: "PATCH", token }),

  getPoll: (shareCode) => request(`/polls/${shareCode}`),
  vote: (shareCode, optionId) =>
    request(`/polls/${shareCode}/vote`, { method: "POST", body: { optionId } }),
  getResults: (shareCode) => request(`/polls/${shareCode}/results`),
};

// WebSocket base URL is derived from the same API base, swapping the
// scheme (http -> ws, https -> wss).
export function wsUrl(shareCode) {
  const httpBase = API_BASE.replace(/\/api\/?$/, "");
  const wsBase = httpBase.replace(/^http/, "ws");
  return `${wsBase}/api/polls/${shareCode}/watch`;
}
