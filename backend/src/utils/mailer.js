import nodemailer from "nodemailer";
import env from "../config/env.js";

// Outgoing mail is optional. A deployment with no SMTP settings runs exactly as
// it always did — callers get told the mail was not sent and carry on, rather
// than a background job throwing every night on a box that was never meant to
// send mail.

let transport = null;
let warnedUnconfigured = false;

export function isMailConfigured() {
  const { host, user, password, from } = env.smtp;
  return Boolean(host && user && password && from);
}

function getTransport() {
  if (transport) return transport;

  transport = nodemailer.createTransport({
    host: env.smtp.host,
    port: env.smtp.port,
    secure: env.smtp.secure,
    auth: { user: env.smtp.user, pass: env.smtp.password }
  });

  return transport;
}

// Resolves to true when the message was handed to the mail server, false when
// there is nothing to send it with. Throws only on a real delivery failure, so
// a caller can tell "not configured" apart from "the server rejected it".
export async function sendMail({ to, subject, text, html }) {
  const recipients = (Array.isArray(to) ? to : [to])
    .map((address) => String(address || "").trim())
    .filter(Boolean);

  if (recipients.length === 0) return false;

  if (!isMailConfigured()) {
    if (!warnedUnconfigured) {
      console.warn(
        "[mailer] SMTP is not configured (SMTP_HOST, SMTP_USER, SMTP_PASS, SMTP_FROM) — no mail will be sent."
      );
      warnedUnconfigured = true;
    }
    return false;
  }

  await getTransport().sendMail({
    from: env.smtp.from,
    to: recipients.join(", "),
    subject,
    text,
    ...(html ? { html } : {})
  });

  return true;
}

// Checks the credentials against the mail server without sending anything.
export async function verifyMailConnection() {
  if (!isMailConfigured()) return false;
  await getTransport().verify();
  return true;
}
