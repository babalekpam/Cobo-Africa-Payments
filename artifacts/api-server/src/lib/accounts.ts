// One rule for "may this account use the platform right now?", used everywhere a session,
// token or API key is accepted (login, every authenticated request, WebSocket handshake,
// merchant API keys). Only a fully active account passes: suspended, pending and deactivated
// accounts are all refused, and the check reads the database, never the token's claims.

export function accountIsActive(user: { status?: string | null; isActive?: string | null }): boolean {
  return user.status === "active" && user.isActive !== "false";
}

/** A token is current only while its session version matches the account's (tokens from before
 *  versioning carry none and count as version 0, which is also every account's starting value). */
export function sessionIsCurrent(token: { sv?: number }, user: { sessionVersion?: number | null }): boolean {
  return (token.sv ?? 0) === (user.sessionVersion ?? 0);
}

export function isAdminRole(user: { role?: string | null } | undefined): boolean {
  return user?.role === "admin";
}
