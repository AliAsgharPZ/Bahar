import { NextRequest } from "next/server";
import crypto from "crypto";
import { runSchedulerTick } from "@/lib/scheduler";

// POST /api/internal/sweeps — runs one scheduler tick.
// Entry point for the Cloudflare Cron Trigger (see worker.ts); on
// self-hosted Node the in-process timer calls the same tick instead.
// Protected by the CRON_SECRET shared secret — never expose it publicly
// without the secret configured.
export async function POST(req: NextRequest) {
  const expected = process.env.CRON_SECRET ?? "";
  const provided = req.headers.get("x-bahar-cron-secret") ?? "";
  const ok =
    expected.length >= 16 &&
    provided.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
  if (!ok) return new Response("Unauthorized", { status: 401 });

  await runSchedulerTick();
  return Response.json({ ok: true });
}
