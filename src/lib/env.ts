import { z } from "zod";

const serverSchema = z.object({
  APP_URL: z.string().url(),
  DATABASE_URL: z.string().min(1),
  DIRECT_URL: z.string().min(1),
  AUTH_SECRET: z.string().min(24),
  TOKEN_ENCRYPTION_KEY: z.string().min(24),
  PRIVATE_CONTEXT_ENCRYPTION_KEY: z.string().min(24),
  GOOGLE_CLIENT_ID: z.string().endsWith(".apps.googleusercontent.com"),
  GOOGLE_CLIENT_SECRET: z.string().min(8),
  GOOGLE_REDIRECT_URI: z.string().url(),
  GOOGLE_CLOUD_PROJECT_ID: z.string().min(1),
  GEMINI_API_KEY: z.string().min(8),
  AI_PROVIDER: z.literal("gemini"),
  AI_MODEL: z.literal("gemini-2.5-flash"),
  ENABLE_EXTERNAL_AI: z.enum(["true", "false"]).default("false"),
  ENABLE_SEQUENCE_SENDING: z.enum(["true", "false"]).default("false"),
  CRON_SECRET: z.string().min(24).optional(),
  DEMO_GMAIL_USER: z.string().email().optional(),
  DEMO_GOOGLE_CREDENTIALS: z.string().min(20).optional(),
});

let cached: z.infer<typeof serverSchema> | undefined;
export function env() {
  if (!cached) cached = serverSchema.parse(process.env);
  return cached;
}
