export function validateBody(schema) {
  return (req, res, next) => {
    const parsed = schema.safeParse(req.body);

    if (!parsed.success) {
      const error = new Error("Please review the highlighted fields.");
      error.statusCode = 400;
      error.details = parsed.error.flatten().fieldErrors;
      return next(error);
    }

    req.validatedBody = parsed.data;
    return next();
  };
}
