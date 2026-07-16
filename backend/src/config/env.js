import dotenv from "dotenv";

dotenv.config();

const isProduction = process.env.NODE_ENV === "production";
const DEV_JWT_FALLBACK = "dev_secret_change_me";
const MIN_JWT_SECRET_LENGTH = 32;

// In production a strong secret is mandatory: a missing or weak JWT_SECRET
// means tokens can be forged, so fail fast at startup rather than silently
// signing with a guessable default. In development we allow a fallback so
// the app still boots locally, but warn loudly.
function resolveJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (isProduction) {
    if (!secret || secret.length < MIN_JWT_SECRET_LENGTH) {
      throw new Error(
        `JWT_SECRET must be set to a strong value of at least ${MIN_JWT_SECRET_LENGTH} characters in production.`
      );
    }
    return secret;
  }
  if (!secret) {
    console.warn("[env] JWT_SECRET is not set — using an insecure development fallback. Do not use this in production.");
    return DEV_JWT_FALLBACK;
  }
  return secret;
}

const env = {
  port: process.env.PORT || 5001,
  dbUrl: process.env.DATABASE_URL,
  jwtSecret: resolveJwtSecret(),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",
  clientOrigin:
    process.env.CLIENT_ORIGIN ||
    "http://localhost:5174,http://127.0.0.1:5174,http://192.168.1.*:5174,http://localhost:4173,http://127.0.0.1:4173,http://192.168.1.*:4173,http://app.nimbasia.com,https://app.nimbasia.com"
};

export default env;
