// One rule for "may this account use the platform right now?", used everywhere a session,
// token or API key is accepted (login, every authenticated request, WebSocket handshake,
// merchant API keys). Only a fully active account passes: suspended, pending and deactivated
// accounts are all refused, and the check reads the database, never the token's claims.

export function accountIsActive(user: { status?: string | null; isActive?: string | null }): boolean {
  return user.status === "active" && user.isActive !== "false";
}

export function isAdminRole(user: { role?: string | null } | undefined): boolean {
  return user?.role === "admin";
}
