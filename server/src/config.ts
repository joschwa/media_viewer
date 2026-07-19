import "dotenv/config";
import { z } from "zod";

const envSchema = z
  .object({
    DATABASE_URL: z.string().min(1),
    MEDIA_ROOT: z.string().min(1),
    COOKIE_SECRET: z.string().min(32, "COOKIE_SECRET must be at least 32 characters"),
    PORT: z.coerce.number().int().positive().default(3000),
    SESSION_TTL_DAYS: z.coerce.number().int().positive().default(30),
    // Cookies are only marked Secure once HTTPS is wired up (Milestone 6) — forcing it earlier
    // would make the session cookie silently not stick over plain HTTP during local dev.
    HTTPS_ENABLED: z
      .string()
      .optional()
      .transform((v) => v === "true"),
    TLS_KEY_PATH: z.string().optional(),
    TLS_CERT_PATH: z.string().optional(),
  })
  .refine((env) => !env.HTTPS_ENABLED || (env.TLS_KEY_PATH && env.TLS_CERT_PATH), {
    message: "TLS_KEY_PATH and TLS_CERT_PATH are required when HTTPS_ENABLED=true",
  });

const env = envSchema.parse(process.env);

export const config = {
  databaseUrl: env.DATABASE_URL,
  mediaRoot: env.MEDIA_ROOT,
  cookieSecret: env.COOKIE_SECRET,
  port: env.PORT,
  sessionTtlDays: env.SESSION_TTL_DAYS,
  httpsEnabled: env.HTTPS_ENABLED,
  tlsKeyPath: env.TLS_KEY_PATH,
  tlsCertPath: env.TLS_CERT_PATH,
};
