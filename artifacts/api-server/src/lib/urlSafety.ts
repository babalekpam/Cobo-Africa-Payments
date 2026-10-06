// Outbound URL safety (SSRF guard) shared by merchant webhooks and participant
// gateway URLs. String-level checks only: it rejects loopback, private, link-local,
// unique-local and obfuscated-numeric hosts and URLs carrying credentials.
// Known limit: it cannot stop a public hostname that *resolves* to a private
// address (DNS rebinding); keep outbound destinations operator-controlled and
// enforce egress rules at the network layer in production.

export interface OutboundUrlOptions {
  /** Require https (use for anything carrying payment data in production). */
  requireHttps?: boolean;
}

export function isSafeOutboundUrl(url: string, opts: OutboundUrlOptions = {}): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && (opts.requireHttps || parsed.protocol !== "http:")) return false;
    if (parsed.username || parsed.password) return false;
    const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, "");
    if (host === "localhost" || host === "127.0.0.1" || host === "0.0.0.0" || host === "::1" || host === "::") return false;
    if (host.startsWith("127.") || host.startsWith("10.") || host.startsWith("192.168.") || host.startsWith("169.254.")) return false;
    if (/^172\.(1[6-9]|2\d|3[01])\./.test(host)) return false;
    // IPv6 loopback/link-local/unique-local
    if (host.startsWith("fe80:") || host.startsWith("fc") || host.startsWith("fd") || host.startsWith("::ffff:")) return false;
    // Reject non-dotted numeric encodings of IPs (e.g. http://2130706433/, 0x7f000001)
    if (/^\d+$/.test(host) || /^0x[0-9a-f]+$/.test(host) || /^0\d+/.test(host)) return false;
    if (host.endsWith(".internal") || host.endsWith(".local")) return false;
    return true;
  } catch {
    return false;
  }
}
