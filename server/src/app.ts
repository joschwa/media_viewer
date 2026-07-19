import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import fastifyCookie from "@fastify/cookie";
import fastifyHelmet from "@fastify/helmet";
import fastifyMultipart from "@fastify/multipart";
import fastifyRateLimit from "@fastify/rate-limit";
import fastifyStatic from "@fastify/static";
import Fastify, { type FastifyError } from "fastify";
import { ZodError } from "zod";
import { registerAdminRoutes } from "./admin/admin.routes.js";
import { registerAuthGuards } from "./auth/guards.js";
import { registerAuthRoutes } from "./auth/auth.routes.js";
import { config } from "./config.js";
import { registerMediaRoutes } from "./media/media.routes.js";
import { registerTagRoutes } from "./tags/tags.routes.js";

// Works whether this runs via tsx from server/src/ (dev) or compiled in server/dist/ (prod) —
// both are exactly two levels below the repo root, where web/dist lives as a sibling of server/.
const webDistPath = path.resolve(import.meta.dirname, "../../web/dist");

export async function buildApp() {
  const app = Fastify({
    logger: true,
    ...(config.httpsEnabled
      ? { https: { key: readFileSync(config.tlsKeyPath!), cert: readFileSync(config.tlsCertPath!) } }
      : {}),
  });

  await app.register(fastifyHelmet);
  await app.register(fastifyCookie, { secret: config.cookieSecret });
  await app.register(fastifyRateLimit, { max: 100, timeWindow: "1 minute" });
  await app.register(fastifyMultipart, {
    limits: { fileSize: 1_000_000_000, files: 20 },
    throwFileSizeLimit: true,
  });
  // serve: false — no auto-registered routes; this only adds reply.sendFile(), so every file
  // access still goes through our own owner-or-public authorization check in media.routes.ts.
  await app.register(fastifyStatic, { root: config.mediaRoot, serve: false });

  // Serves the built frontend (`npm run build --workspace web`) so the Pi can run this as the
  // only process — a no-op until web/dist exists (e.g. a fresh checkout before the first build).
  if (existsSync(webDistPath)) {
    await app.register(fastifyStatic, { root: webDistPath, prefix: "/", decorateReply: false });
  }

  registerAuthGuards(app);
  registerAuthRoutes(app);
  registerAdminRoutes(app);
  registerMediaRoutes(app);
  registerTagRoutes(app);

  app.get("/api/health", async () => ({ ok: true }));

  app.setErrorHandler((err: FastifyError | ZodError, _request, reply) => {
    if (err instanceof ZodError) {
      reply.code(400).send({ error: "Invalid request", details: err.issues });
      return;
    }
    // Fastify's own errors (bad JSON body, payload too large, etc.) already carry the right
    // client-error status code — only fall back to a generic 500 for genuinely unexpected errors.
    if (err.statusCode && err.statusCode < 500) {
      reply.code(err.statusCode).send({ error: err.message });
      return;
    }
    app.log.error(err);
    reply.code(500).send({ error: "Internal server error" });
  });

  return app;
}
