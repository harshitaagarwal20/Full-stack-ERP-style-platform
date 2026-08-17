import assert from "node:assert/strict";
import { resolveStageProgress } from "../src/services/enquiryService.js";

// An edit that says nothing about the stage leaves it where it was.
const untouched = resolveStageProgress(
  { stage: "GENERAL", sampledAt: null, price: null },
  { requestedStage: undefined, nextPrice: undefined }
);
assert.equal(untouched.stage, "GENERAL");
assert.equal(untouched.sampledAt, null);

// Moving an enquiry to Sampled starts the follow-up clock.
const justSampled = resolveStageProgress(
  { stage: "GENERAL", sampledAt: null, price: null },
  { requestedStage: "SAMPLED", nextPrice: null }
);
assert.equal(justSampled.stage, "SAMPLED");
assert.ok(justSampled.sampledAt instanceof Date);

// The clock is not restarted by later edits — it marks when the sample went out.
const sampledEarlier = new Date("2026-08-01T00:00:00.000Z");
const stillSampled = resolveStageProgress(
  { stage: "SAMPLED", sampledAt: sampledEarlier, price: null },
  { requestedStage: "SAMPLED", nextPrice: null }
);
assert.equal(stillSampled.sampledAt, sampledEarlier);

// Pricing a sampled enquiry is quoting it: the stage advances on its own, and
// the enquiry drops off the Sampled Enquiries screen without anyone saying so.
const priced = resolveStageProgress(
  { stage: "SAMPLED", sampledAt: sampledEarlier, price: null },
  { requestedStage: undefined, nextPrice: 250 }
);
assert.equal(priced.stage, "QUOTED");
assert.equal(priced.sampledAt, sampledEarlier);

// An enquiry that was already priced does not auto-advance — the price was
// there before the sample went out, so it says nothing about a new quote.
const alreadyPriced = resolveStageProgress(
  { stage: "SAMPLED", sampledAt: sampledEarlier, price: 250 },
  { requestedStage: "SAMPLED", nextPrice: 250 }
);
assert.equal(alreadyPriced.stage, "SAMPLED");

// Clearing the price does not push it forward either.
const clearedPrice = resolveStageProgress(
  { stage: "SAMPLED", sampledAt: sampledEarlier, price: null },
  { requestedStage: "SAMPLED", nextPrice: null }
);
assert.equal(clearedPrice.stage, "SAMPLED");

// Pricing an enquiry that was never sampled leaves it where it is: a quote
// straight off a general enquiry is set by hand, not inferred.
const generalPriced = resolveStageProgress(
  { stage: "GENERAL", sampledAt: null, price: null },
  { requestedStage: undefined, nextPrice: 400 }
);
assert.equal(generalPriced.stage, "GENERAL");

// A stage that is not one of the three is ignored rather than trusted.
const nonsense = resolveStageProgress(
  { stage: "SAMPLED", sampledAt: sampledEarlier, price: null },
  { requestedStage: "SHIPPED", nextPrice: null }
);
assert.equal(nonsense.stage, "SAMPLED");

console.log("enquiryStage assertions passed");
