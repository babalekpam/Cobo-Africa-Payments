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

export function signToken(payload: { id: number; email: string; role: string }): string {
  return jwt.sign(payload, JWT_SECRET as string, { expiresIn: JWT_EXPIRES_IN });
}

export function verifyToken(token: string): { id: number; email: string; role: string } | null {
  try {
    return jwt.verify(token, JWT_SECRET as string) as { id: number; email: string; role: string };
  } catch {
    return null;
  }
}
