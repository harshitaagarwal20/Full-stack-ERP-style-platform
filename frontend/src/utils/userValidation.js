const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeText(value) {
  return String(value || "").trim();
}

function buildError(message) {
  return [message];
}

export function validateUserForm(form, { isEditing = false } = {}) {
  const errors = {};
  const name = normalizeText(form.name);
  const email = normalizeText(form.email);
  const password = String(form.password || "");
  const role = normalizeText(form.role);

  if (name.length < 2) {
    errors.name = buildError("Name must be at least 2 characters.");
  }

  if (!email) {
    errors.email = buildError("Email is required.");
  } else if (!EMAIL_PATTERN.test(email)) {
    errors.email = buildError("Enter a valid email address.");
  }

  if (isEditing) {
    if (password && password.length < 6) {
      errors.password = buildError("Password must be at least 6 characters.");
    }
  } else if (!password) {
    errors.password = buildError("Password is required.");
  } else if (password.length < 6) {
    errors.password = buildError("Password must be at least 6 characters.");
  }

  if (!role) {
    errors.role = buildError("Please select a role.");
  }

  return errors;
}

