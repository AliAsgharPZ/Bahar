// Bahar | Cloudflare Worker entry.
// The fetch handler is the OpenNext-generated one; this wrapper only adds
// the Cron Trigger that drives the app's periodic sweeps (the equivalent
// of the in-process timer used on self-hosted Node).
// @ts-ignore — generated at build time by `opennextjs-cloudflare build`
import openNextWorker from "./.open-next/worker.js";

type Env = { CRON_SECRET?: string };

const worker = {
  fetch: openNextWorker.fetch,
  async scheduled(
    _event: { cron: string },
    env: Env,
    ctx: { waitUntil(p: Promise<unknown>): void }
  ) {
    const req = new Request("https://bahar.internal/api/internal/sweeps", {
      method: "POST",
      headers: { "x-bahar-cron-secret": env.CRON_SECRET ?? "" },
    });
    ctx.waitUntil(
      (openNextWorker.fetch as (r: Request, e: Env, c: unknown) => Promise<Response>)(req, env, ctx)
    );
  },
};

export default worker;
