import crypto from "crypto";
import type { NextFunction, Request, Response } from "express";

type AuthPayload = {
  sub: string;
  email: string;
  name: string;
  exp: number;
};

function clean(value: any) {
  return String(value || "").trim();
}

function base64url(input: Buffer | string) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function fromBase64url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);

  return Buffer.from(padded, "base64").toString("utf8");
}

function getJwtSecret() {
  return clean(process.env.CRM_JWT_SECRET || process.env.JWT_SECRET);
}

function signToken(payload: AuthPayload) {
  const secret = getJwtSecret();

  if (!secret) {
    throw new Error("CRM_JWT_SECRET missing in backend env");
  }

  const header = {
    alg: "HS256",
    typ: "JWT",
  };

  const encodedHeader = base64url(JSON.stringify(header));
  const encodedPayload = base64url(JSON.stringify(payload));

  const signature = crypto
    .createHmac("sha256", secret)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest();

  return `${encodedHeader}.${encodedPayload}.${base64url(signature)}`;
}

export function verifyAuthToken(token: string): AuthPayload | null {
  try {
    const secret = getJwtSecret();

    if (!secret) return null;

    const parts = clean(token).split(".");

    if (parts.length !== 3) return null;

    const [encodedHeader, encodedPayload, encodedSignature] = parts;

    const expectedSignature = base64url(
      crypto
        .createHmac("sha256", secret)
        .update(`${encodedHeader}.${encodedPayload}`)
        .digest()
    );

    const left = Buffer.from(encodedSignature);
    const right = Buffer.from(expectedSignature);

    if (left.length !== right.length) return null;

    if (!crypto.timingSafeEqual(left, right)) return null;

    const payload = JSON.parse(fromBase64url(encodedPayload)) as AuthPayload;

    if (!payload?.exp || Date.now() > payload.exp * 1000) return null;

    return payload;
  } catch {
    return null;
  }
}

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);

  if (left.length !== right.length) return false;

  return crypto.timingSafeEqual(left, right);
}

function getTokenFromRequest(req: Request) {
  const authHeader = clean(req.headers.authorization);

  if (authHeader.toLowerCase().startsWith("bearer ")) {
    return authHeader.slice(7).trim();
  }

  const cookieHeader = clean(req.headers.cookie);

  const cookieToken = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("crm_token="));

  if (cookieToken) {
    return decodeURIComponent(cookieToken.replace("crm_token=", ""));
  }

  return "";
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = getTokenFromRequest(req);
  const user = verifyAuthToken(token);

  if (!user) {
    return res.status(401).json({
      success: false,
      message: "Unauthorized",
    });
  }

  (req as any).user = user;

  return next();
}

export async function login(req: Request, res: Response) {
  try {
    const email = clean(req.body?.email).toLowerCase();
    const password = clean(req.body?.password);

    const adminEmail = clean(process.env.CRM_ADMIN_EMAIL).toLowerCase();
    const adminPassword = clean(process.env.CRM_ADMIN_PASSWORD);

    if (!adminEmail || !adminPassword || !getJwtSecret()) {
      return res.status(500).json({
        success: false,
        message:
          "Auth env missing. Set CRM_ADMIN_EMAIL, CRM_ADMIN_PASSWORD and CRM_JWT_SECRET.",
      });
    }

    const validEmail = safeEqual(email, adminEmail);
    const validPassword = safeEqual(password, adminPassword);

    if (!validEmail || !validPassword) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password.",
      });
    }

    const user = {
      email: adminEmail,
      name: "Outreach Admin",
    };

    const token = signToken({
      sub: adminEmail,
      email: adminEmail,
      name: user.name,
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7,
    });

    return res.json({
      success: true,
      token,
      user,
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: error.message || "Login failed.",
    });
  }
}

export async function me(req: Request, res: Response) {
  return res.json({
    success: true,
    user: (req as any).user,
  });
}
