import assert from "node:assert/strict";
import { groupByRecipient } from "../src/services/sampleFollowUpMailService.js";

const adminEmails = ["admin@nimbasia.test", "second.admin@nimbasia.test"];

const approvedByAnita = { id: 1, name: "Anita", email: "anita@nimbasia.test" };
const approvedByRahul = { id: 2, name: "Rahul", email: "rahul@nimbasia.test" };

// The approving admin is the one chased, so two enquiries approved by the same
// person arrive as one mail rather than two.
const sameApprover = groupByRecipient(
  [
    { id: 10, approvedBy: approvedByAnita },
    { id: 11, approvedBy: approvedByAnita }
  ],
  adminEmails
);
assert.equal(sameApprover.length, 1);
assert.deepEqual(sameApprover[0].addresses, ["anita@nimbasia.test"]);
assert.equal(sameApprover[0].enquiries.length, 2);

// Different approvers each get their own mail, carrying only their enquiries.
const twoApprovers = groupByRecipient(
  [
    { id: 10, approvedBy: approvedByAnita },
    { id: 11, approvedBy: approvedByRahul }
  ],
  adminEmails
);
assert.equal(twoApprovers.length, 2);
assert.deepEqual(twoApprovers.map((group) => group.enquiries.length), [1, 1]);

// A sampled enquiry usually has not been approved yet. Those must not fall
// through the cracks — they go to every admin instead.
const noApprover = groupByRecipient([{ id: 12, approvedBy: null }], adminEmails);
assert.equal(noApprover.length, 1);
assert.deepEqual(noApprover[0].addresses, adminEmails);

// Approved and unapproved enquiries in the same run are kept apart.
const mixed = groupByRecipient(
  [
    { id: 10, approvedBy: approvedByAnita },
    { id: 12, approvedBy: null },
    { id: 13, approvedBy: null }
  ],
  adminEmails
);
assert.equal(mixed.length, 2);
const adminGroup = mixed.find((group) => group.addresses.length === 2);
assert.equal(adminGroup.enquiries.length, 2);

// An approver whose account has no email address is treated as unapproved
// rather than producing a mail addressed to nobody.
const blankEmail = groupByRecipient(
  [{ id: 14, approvedBy: { id: 3, name: "Ghost", email: "  " } }],
  adminEmails
);
assert.deepEqual(blankEmail[0].addresses, adminEmails);

// With no approver and no admin accounts there is nobody to write to, so the
// enquiry is skipped rather than mailed into the void.
assert.deepEqual(groupByRecipient([{ id: 15, approvedBy: null }], []), []);

// The same person recorded with different casing is still one recipient.
const casing = groupByRecipient(
  [
    { id: 16, approvedBy: { id: 4, name: "Anita", email: "Anita@Nimbasia.test" } },
    { id: 17, approvedBy: approvedByAnita }
  ],
  adminEmails
);
assert.equal(casing.length, 1);
assert.equal(casing[0].enquiries.length, 2);

console.log("sampleFollowUpMail assertions passed");
