import test from "node:test";
import assert from "node:assert/strict";
import { validateUserForm } from "../src/utils/userValidation.js";

test("validateUserForm flags short password on create", () => {
  const errors = validateUserForm({
    name: "Jane Doe",
    email: "jane@example.com",
    password: "123",
    role: "sales"
  });

  assert.deepEqual(errors.password, ["Password must be at least 6 characters."]);
});

test("validateUserForm allows empty password on edit", () => {
  const errors = validateUserForm({
    name: "Jane Doe",
    email: "jane@example.com",
    password: "",
    role: "sales"
  }, { isEditing: true });

  assert.equal(errors.password, undefined);
});

test("validateUserForm flags invalid email and short name", () => {
  const errors = validateUserForm({
    name: "A",
    email: "invalid",
    password: "123456",
    role: "sales"
  });

  assert.deepEqual(errors.name, ["Name must be at least 2 characters."]);
  assert.deepEqual(errors.email, ["Enter a valid email address."]);
});

