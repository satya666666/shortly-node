import type { ErrorRequestHandler } from "express";

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (err instanceof Error && err.message === "CODE_TAKEN") {
    // Collision after a race on code generation; the client can simply retry.
    res.status(409).json({ error: "code_taken", message: "Short code already exists, please retry." });
    return;
  }
  console.error(`[shortly] unhandled error on ${req.method} ${req.path}:`, err);
  res.status(500).json({ error: "internal_error", message: "Unexpected server error." });
};
