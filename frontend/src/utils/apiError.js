import { dispatchUserMessage, getUserFacingErrorMessage } from "./errorMessages";

export function logApiError(error, fallback = "Something went wrong.") {
  const message = getUserFacingErrorMessage(error, fallback);
  dispatchUserMessage(message);
  console.error(error);
  return message;
}
