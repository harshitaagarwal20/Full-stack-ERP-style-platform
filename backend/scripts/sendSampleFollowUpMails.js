// Runs the overdue-sample reminder once, now, instead of waiting for the daily
// schedule. Use it to check SMTP is working after filling in the credentials:
//
//   npm run mail:sample-follow-up
//
// It sends real mail. Every enquiry it mails is stamped, so a second run sends
// nothing — that is the same guard the scheduled job relies on.
import { sendSampleFollowUpMails } from "../src/services/sampleFollowUpMailService.js";
import { verifyMailConnection, isMailConfigured } from "../src/utils/mailer.js";
import { closePrisma } from "../src/config/prisma.js";

async function main() {
  if (!isMailConfigured()) {
    console.error(
      "SMTP is not configured. Set SMTP_HOST, SMTP_USER, SMTP_PASS and SMTP_FROM in backend/.env first."
    );
    process.exitCode = 1;
    return;
  }

  try {
    await verifyMailConnection();
    console.log("SMTP connection OK.");
  } catch (error) {
    console.error("SMTP connection failed:", error?.message || error);
    process.exitCode = 1;
    return;
  }

  const result = await sendSampleFollowUpMails();

  if (result.checked === 0) {
    console.log("No sampled enquiry is overdue. Nothing to send.");
    return;
  }

  console.log(
    `Overdue enquiries: ${result.checked}. Mails sent: ${result.mailsSent}. Enquiries covered: ${result.enquiriesMailed}.`
  );
}

main()
  .catch((error) => {
    console.error("Failed to send sample follow-up mail:", error);
    process.exitCode = 1;
  })
  .finally(() => closePrisma());
