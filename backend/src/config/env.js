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

function toPositiveInt(value, fallback) {
  const parsed = Number.parseInt(String(value ?? "").trim(), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

const env = {
  port: process.env.PORT || 5001,
  dbUrl: process.env.DATABASE_URL,
  jwtSecret: resolveJwtSecret(),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",
  clientOrigin:
    process.env.CLIENT_ORIGIN ||
    "http://localhost:5174,http://127.0.0.1:5174,http://192.168.1.*:5174,http://localhost:4173,http://127.0.0.1:4173,http://192.168.1.*:4173,http://app.nimbasia.com,https://app.nimbasia.com",
  // Outgoing mail. Absent SMTP settings are not an error: the app runs exactly
  // as before and the reminder job stands down rather than failing every night.
  smtp: {
    host: process.env.SMTP_HOST || "",
    port: toPositiveInt(process.env.SMTP_PORT, 465),
    // Hostinger's mailboxes take implicit TLS on 465. Set SMTP_SECURE=false for
    // a provider that expects STARTTLS on 587.
    secure: String(process.env.SMTP_SECURE ?? "true").toLowerCase() !== "false",
    user: process.env.SMTP_USER || "",
    password: process.env.SMTP_PASS || "",
    // Most mailboxes refuse to send as an address they do not own, so this
    // defaults to the account being authenticated with.
    from: process.env.SMTP_FROM || process.env.SMTP_USER || ""
  },
  // Days an enquiry may sit at Sampled before the approving admin is emailed.
  // The in-app follow-up banner has its own, shorter threshold.
  sampleFollowUpMailDays: toPositiveInt(process.env.SAMPLE_FOLLOW_UP_MAIL_DAYS, 15),
  appUrl: process.env.APP_URL || "https://app.nimbasia.com"
};

export default env;