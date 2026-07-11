// Sampled enquiries go stale. If one has been sitting at the "Sampled" stage
// for this long without moving to Quoted, the owner gets nudged to call the
// client. Kept in sync with SAMPLED_FOLLOW_UP_DAYS in the backend.
export const SAMPLED_FOLLOW_UP_DAYS = 12;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function daysSince(dateValue) {
  if (!dateValue) return null;
  const then = new Date(dateValue);
  if (Number.isNaN(then.getTime())) return null;
  return Math.floor((Date.now() - then.getTime()) / MS_PER_DAY);
}

// An enquiry needs following up when it's still sampled (not yet quoted, not
// closed out by approval) and has been that way past the threshold.
export function isFollowUpDue(enquiry) {
  if (!enquiry || enquiry.stage !== "SAMPLED") return false;
  if (enquiry.status === "REJECTED" || enquiry.status === "ACCEPTED") return false;
  const days = daysSince(enquiry.sampledAt);
  return days !== null && days >= SAMPLED_FOLLOW_UP_DAYS;
}

export function getFollowUpEnquiries(enquiries = []) {
  return enquiries
    .filter(isFollowUpDue)
    .sort((a, b) => (daysSince(b.sampledAt) || 0) - (daysSince(a.sampledAt) || 0));
}

// The message the user actually reads. Written from their side of the screen:
// says who to call, how long it's been, and what to do about it.
export function buildFollowUpMessage(enquiry) {
  const days = daysSince(enquiry.sampledAt);
  const company = enquiry.companyName || "this client";
  const ref = enquiry.enquiryNumber ? ` (${enquiry.enquiryNumber})` : "";
  return `Sample sent to ${company}${ref} ${days} days ago with no quote yet — time to follow up.`;
}

export function buildFollowUpSummary(followUps = []) {
  if (followUps.length === 0) return "";
  if (followUps.length === 1) return buildFollowUpMessage(followUps[0]);
  return `${followUps.length} sampled enquiries have had no quote for over ${SAMPLED_FOLLOW_UP_DAYS} days — follow up with these clients.`;
}
