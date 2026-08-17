import env from "../config/env.js";
import { isMailConfigured } from "./mailer.js";
import { sendSampleFollowUpMails } from "../services/sampleFollowUpMailService.js";

// Runs the overdue-sample reminder on a timer. There is no cron on the host, so
// the app checks for itself: a few minutes after boot, then once a day.
//
// The interval is not what stops duplicate mail — the stamp the service writes
// on each enquiry does. That means a restart, or two runs in one day, costs
// nothing, and it is why the schedule can stay this simple.

const START_DELAY_MS = 5 * 60 * 1000;
const RUN_INTERVAL_MS = 24 * 60 * 60 * 1000;

let startTimer = null;
let intervalTimer = null;
let running = false;

async function run() {
  // Overlapping runs would mail the same enquiry twice before either had a
  // chance to stamp it.
  if (running) return;
  running = true;

  try {
    const result = await sendSampleFollowUpMails();
    if (result.skipped === "smtp-not-configured") {
      console.warn(
        `[sample-follow-up] ${result.checked} enquiries are overdue but SMTP is not configured — no mail sent.`
      );
      return;
    }
    if (result.mailsSent > 0) {
      console.log(
        `[sample-follow-up] Sent ${result.mailsSent} reminder(s) covering ${result.enquiriesMailed} enquiries.`
      );
    }
  } catch (error) {
    // A failed run is not fatal: tomorrow's run picks up everything still
    // unmailed, because nothing was stamped.
    console.warn("[sample-follow-up] Run failed:", error?.message || error);
  } finally {
    running = false;
  }
}

export function startSampleFollowUpScheduler() {
  if (startTimer || intervalTimer) return;

  if (!isMailConfigured()) {
    console.warn(
      "[sample-follow-up] SMTP is not configured — the sample reminder job will not run. " +
      "Set SMTP_HOST, SMTP_USER, SMTP_PASS and SMTP_FROM to enable it."
    );
    return;
  }

  console.log(
    `[sample-follow-up] Reminder job scheduled: samples unquoted after ${env.sampleFollowUpMailDays} days.`
  );

  // unref() so neither timer keeps the process alive on its own at shutdown.
  startTimer = setTimeout(() => {
    startTimer = null;
    run();
    intervalTimer = setInterval(run, RUN_INTERVAL_MS);
    if (typeof intervalTimer.unref === "function") intervalTimer.unref();
  }, START_DELAY_MS);
  if (typeof startTimer.unref === "function") startTimer.unref();
}

export function stopSampleFollowUpScheduler() {
  if (startTimer) {
    clearTimeout(startTimer);
    startTimer = null;
  }
  if (intervalTimer) {
    clearInterval(intervalTimer);
    intervalTimer = null;
  }
}
