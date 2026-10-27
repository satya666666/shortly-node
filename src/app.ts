import express, { type Express } from "express";
import type { UrlRepository } from "./repositories/urlRepository.js";
import { urlsRouter } from "./routes/urls.js";
import { errorHandler } from "./middleware/errorHandler.js";

export interface AppDependencies {
  repository: UrlRepository;
  /** Clock injected for deterministic, testable click-timestamps. */
  now?: () => Date;
}

/** Builds the Express app with all routes and middleware wired. */
export function createApp(deps: AppDependencies): Express {
  const app = express();
  app.use(express.json());

  app.use("/api", urlsRouter(deps));

  app.use(errorHandler);
  return app;
}
