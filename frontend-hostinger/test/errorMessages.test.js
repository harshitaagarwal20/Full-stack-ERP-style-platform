import test from "node:test";
import assert from "node:assert/strict";
import { getUserFacingErrorMessage, getValidationFieldErrors } from "../src/utils/errorMessages.js";

test("maps network failures to a plain-language message", () => {
  const message = getUserFacingErrorMessage({ message: "Network Error" }, "Fallback");
  assert.match(message, /could not reach the server/i);
});

test("keeps login credential errors readable", () => {
  const message = getUserFacingErrorMessage({
    response: {
      status: 401,
      data: { message: "Invalid email or password." }
    }
  });

  assert.equal(message, "Invalid email or password.");
});

test("summarizes validation errors for end users", () => {
  const message = getUserFacingErrorMessage({
    response: {
      status: 400,
      data: {
        message: "Please review the highlighted fields.",
        errors: {
          email: ["Email is required."],
          password: ["Password is required."]
        }
      }
    }
  });

  assert.match(message, /please check the highlighted fields/i);
  assert.match(message, /Email is required\./i);
});

test("hides technical route not found messages", () => {
  const message = getUserFacingErrorMessage({
    response: {
      status: 404,
      data: { message: "Route not found: /api/auth/login" }
    }
  });

  assert.equal(message, "The requested item could not be found.");
});

test("extracts backend field validation errors", () => {
  const fieldErrors = getValidationFieldErrors({
    response: {
      status: 400,
      data: {
        errors: {
          email: ["Email is required."],
          password: ["Password is required."]
        }
      }
    }
  });

  assert.deepStrictEqual(fieldErrors, {
    email: ["Email is required."],
    password: ["Password is required."]
  });
});
