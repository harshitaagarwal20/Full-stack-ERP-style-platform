import prisma from "../config/prisma.js";
import env from "../config/env.js";
import { isMailConfigured, sendMail } from "../utils/mailer.js";

// A sample goes out and then nothing happens. This chases it: once an enquiry
// has sat at the Sampled stage for the configured number of days with no price
// quoted, the admin who approved it gets one email naming the client to call.
//
// "One" is the important part — the mail is stamped on the enquiry when it is
// sent, so the same overdue sample is never mailed twice however often the job
// runs. An enquiry that is later quoted, accepted or rejected drops out of the
// query on its own.

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function formatDate(dateValue) {
  if (!dateValue) return "-";
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return "-";
  return `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}/${date.getFullYear()}`;
}

function daysSince(dateValue) {
  if (!dateValue) return 0;
  return Math.floor((Date.now() - new Date(dateValue).getTime()) / MS_PER_DAY);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function describe(enquiry) {
  const reference = enquiry.enquiryNumber || `#${enquiry.id}`;
  const quantity = enquiry.quantity ? `${enquiry.quantity} ${enquiry.unitOfMeasurement || ""}`.trim() : "-";
  return {
    reference,
    company: enquiry.companyName || "-",
    product: enquiry.product || "-",
    quantity,
    owner: enquiry.assignedPerson || "-",
    sampledOn: formatDate(enquiry.sampledAt),
    days: daysSince(enquiry.sampledAt)
  };
}

function buildMessage(enquiries, thresholdDays) {
  const rows = enquiries.map(describe);
  const heading = rows.length === 1
    ? `A sample sent ${rows[0].days} days ago still has no quote.`
    : `${rows.length} samples have been out for more than ${thresholdDays} days with no quote.`;

  const text = [
    heading,
    "",
    ...rows.map((row) => [
      `${row.reference} — ${row.company}`,
      `  Product:  ${row.product}`,
      `  Quantity: ${row.quantity}`,
      `  Sampled:  ${row.sampledOn} (${row.days} days ago)`,
      `  Owner:    ${row.owner}`
    ].join("\n")),
    "",
    `Open the Sampled Enquiries screen: ${env.appUrl}/sampled-enquiries`,
    "",
    "This is an automated reminder from Nimbasia ERP. It is sent once per enquiry."
  ].join("\n");

  const html = [
    `<p>${escapeHtml(heading)}</p>`,
    '<table cellpadding="6" cellspacing="0" border="1" style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:13px">',
    "<tr><th align=\"left\">Enquiry</th><th align=\"left\">Company</th><th align=\"left\">Product</th><th align=\"left\">Quantity</th><th align=\"left\">Sampled</th><th align=\"left\">Waiting</th><th align=\"left\">Owner</th></tr>",
    ...rows.map((row) => `<tr><td>${escapeHtml(row.reference)}</td><td>${escapeHtml(row.company)}</td><td>${escapeHtml(row.product)}</td><td>${escapeHtml(row.quantity)}</td><td>${escapeHtml(row.sampledOn)}</td><td>${row.days} days</td><td>${escapeHtml(row.owner)}</td></tr>`),
    "</table>",
    `<p><a href="${escapeHtml(env.appUrl)}/sampled-enquiries">Open the Sampled Enquiries screen</a></p>`,
    "<p style=\"color:#64748b;font-size:12px\">This is an automated reminder from Nimbasia ERP. It is sent once per enquiry.</p>"
  ].join("\n");

  const subject = rows.length === 1
    ? `Sample follow-up: ${rows[0].company} (${rows[0].days} days, no quote)`
    : `Sample follow-up: ${rows.length} enquiries waiting over ${thresholdDays} days`;

  return { subject, text, html };
}

// Enquiries whose sample has gone quiet and that have not been mailed about yet.
async function findOverdueSampledEnquiries(thresholdDays) {
  const cutoff = new Date(Date.now() - thresholdDays * MS_PER_DAY);

  return prisma.enquiry.findMany({
    where: {
      stage: "SAMPLED",
      sampledAt: { not: null, lte: cutoff },
      sampleFollowUpMailedAt: null,
      // Approved or rejected enquiries are settled — chasing them is noise.
      status: { notIn: ["ACCEPTED", "REJECTED"] }
    },
    select: {
      id: true,
      enquiryNumber: true,
      companyName: true,
      product: true,
      quantity: true,
      unitOfMeasurement: true,
      assignedPerson: true,
      sampledAt: true,
      approvedBy: { select: { id: true, name: true, email: true } }
    },
    orderBy: { sampledAt: "asc" }
  });
}

// A sampled enquiry usually has not been through approval yet, so there is
// often no approver to write to. Rather than let it pass unnoticed, those fall
// back to every admin on the system.
async function getAdminEmails() {
  const admins = await prisma.user.findMany({
    where: { role: "admin" },
    select: { email: true }
  });
  return admins.map((admin) => admin.email).filter(Boolean);
}

export function groupByRecipient(enquiries, adminEmails) {
  const groups = new Map();

  const add = (key, addresses, enquiry) => {
    const existing = groups.get(key);
    if (existing) {
      existing.enquiries.push(enquiry);
      return;
    }
    groups.set(key, { addresses, enquiries: [enquiry] });
  };

  for (const enquiry of enquiries) {
    const approverEmail = String(enquiry.approvedBy?.email || "").trim();
    if (approverEmail) {
      add(`user:${approverEmail.toLowerCase()}`, [approverEmail], enquiry);
      continue;
    }
    if (adminEmails.length > 0) {
      add("admins", adminEmails, enquiry);
    }
  }

  return [...groups.values()];
}

// Returns a summary of what it did, so the caller (and the logs) can tell the
// difference between "nothing was due" and "mail is not set up".
export async function sendSampleFollowUpMails({ thresholdDays = env.sampleFollowUpMailDays } = {}) {
  const overdue = await findOverdueSampledEnquiries(thresholdDays);
  if (overdue.length === 0) {
    return { checked: 0, mailsSent: 0, enquiriesMailed: 0, skipped: null };
  }

  if (!isMailConfigured()) {
    return { checked: overdue.length, mailsSent: 0, enquiriesMailed: 0, skipped: "smtp-not-configured" };
  }

  const groups = groupByRecipient(overdue, await getAdminEmails());
  let mailsSent = 0;
  const mailedEnquiryIds = [];

  for (const group of groups) {
    const { subject, text, html } = buildMessage(group.enquiries, thresholdDays);
    try {
      const sent = await sendMail({ to: group.addresses, subject, text, html });
      if (!sent) continue;
      mailsSent += 1;
      // Only stamp what actually went out: a recipient whose mail failed is
      // retried on the next run rather than being silently dropped.
      mailedEnquiryIds.push(...group.enquiries.map((enquiry) => enquiry.id));
    } catch (error) {
      console.warn(
        `[sample-follow-up] Could not mail ${group.addresses.join(", ")}:`,
        error?.message || error
      );
    }
  }

  if (mailedEnquiryIds.length > 0) {
    await prisma.enquiry.updateMany({
      where: { id: { in: mailedEnquiryIds } },
      data: { sampleFollowUpMailedAt: new Date() }
    });
  }

  return {
    checked: overdue.length,
    mailsSent,
    enquiriesMailed: mailedEnquiryIds.length,
    skipped: null
  };
}
