import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET must be set");
}

export function hashPassword(password: string): string {
  return bcrypt.hashSync(password, 10);
}

export function comparePassword(password: string, hash: string): boolean {
  return bcrypt.compareSync(password, hash);
}

// Shorter-lived sessions by default for a financial service; override with
// JWT_EXPIRES_IN (e.g. "7d") if product needs longer sessions.
const JWT_EXPIRES_IN = (process.env.JWT_EXPIRES_IN || "24h") as jwt.SignOptions["expiresIn"];

export type TokenPayload = { id: number; email: string; role: string; sv?: number };

// `sv` is the account's session version at issue time. A token is only honoured while it still
// matches the account (see sessionIsCurrent), so changing the password revokes every older token.
export function signToken(user: { id: number; email: string; role: string; sessionVersion?: number | null }): string {
  const payload: TokenPayload = { id: user.id, email: user.email, role: user.role, sv: user.sessionVersion ?? 0 };
  return jwt.sign(payload, JWT_SECRET as string, { expiresIn: JWT_EXPIRES_IN });
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET as string) as TokenPayload;
  } catch {
    return null;
  }
}
