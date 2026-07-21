const API_BASE = "/api";

async function request(method: string, path: string, body?: any, extraHeaders?: Record<string, string>) {
  const token = localStorage.getItem("iapay_token");
  const headers: Record<string, string> = { "Content-Type": "application/json", ...(extraHeaders || {}) };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err: any = new Error(data.message || "Request failed");
    err.response = { data, status: res.status };
    throw err;
  }
  return { data };
}

const api = {
  get: (path: string) => request("GET", path),
  post: (path: string, body?: any, headers?: Record<string, string>) => request("POST", path, body, headers),
  put: (path: string, body?: any) => request("PUT", path, body),
  patch: (path: string, body?: any) => request("PATCH", path, body),
  delete: (path: string) => request("DELETE", path),
};

export default api;
