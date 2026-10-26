import fs from "fs/promises";
import path from "path";
import { getCloudflareContext } from "@opennextjs/cloudflare";

// ============================================================
// Bahar | File storage abstraction.
//
// On Cloudflare Workers the files live in an R2 bucket bound as
// BAHAR_FILES. Everywhere else (self-hosted Node/Bun) they live on
// the local filesystem under db/ — keys map 1:1 to paths:
//   "uploads/<name>"    -> db/uploads/<name>
//   "backups/<file>"    -> db/backups/<file>
// ============================================================

type R2BucketLike = {
  put(key: string, value: ArrayBuffer | Uint8Array | string): Promise<unknown>;
  get(key: string): Promise<{ arrayBuffer(): Promise<ArrayBuffer> } | null>;
  delete(key: string): Promise<unknown>;
  list(opts: { prefix: string }): Promise<{ objects: Array<{ key: string }> }>;
};

function r2Bucket(): R2BucketLike | null {
  try {
    const env = getCloudflareContext().env as Record<string, unknown>;
    return (env?.BAHAR_FILES as R2BucketLike | undefined) ?? null;
  } catch {
    return null; // not running on Workers
  }
}

function localPath(key: string): string {
  return path.join(process.cwd(), "db", ...key.split("/"));
}

export async function storagePut(key: string, data: Uint8Array | string): Promise<void> {
  const bucket = r2Bucket();
  if (bucket) {
    await bucket.put(key, typeof data === "string" ? data : new Uint8Array(data));
    return;
  }
  const p = localPath(key);
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, data);
}

export async function storageGet(key: string): Promise<Uint8Array | null> {
  const bucket = r2Bucket();
  if (bucket) {
    const obj = await bucket.get(key);
    if (!obj) return null;
    return new Uint8Array(await obj.arrayBuffer());
  }
  try {
    return await fs.readFile(localPath(key));
  } catch {
    return null;
  }
}

export async function storageGetText(key: string): Promise<string | null> {
  const bytes = await storageGet(key);
  return bytes ? new TextDecoder().decode(bytes) : null;
}

export async function storageDelete(key: string): Promise<void> {
  const bucket = r2Bucket();
  if (bucket) {
    await bucket.delete(key);
    return;
  }
  await fs.unlink(localPath(key)).catch(() => {});
}

/** Lists file names (not full keys) directly under a prefix like "backups/". */
export async function storageList(prefix: string): Promise<string[]> {
  const bucket = r2Bucket();
  if (bucket) {
    const res = await bucket.list({ prefix });
    return res.objects.map((o) => o.key.slice(prefix.length)).filter((n) => n && !n.includes("/"));
  }
  try {
    return await fs.readdir(path.join(process.cwd(), "db", ...prefix.split("/")));
  } catch {
    return [];
  }
}
