import fs from "fs/promises";
import path from "path";
import { getCloudflareContext } from "@opennextjs/cloudflare";

// ============================================================
// Bahar | File storage abstraction.
//
// Backends, in order of preference:
//  1. An R2 bucket bound as BAHAR_FILES (Cloudflare Workers, when
//     the account has R2 activated).
//  2. A D1 table "FileBlob" on the DB binding (Cloudflare Workers
//     without R2 — completely free, no card required; files are
//     stored as BLOBs keyed by their storage key).
//  3. The local filesystem under db/ (self-hosted Node/Bun) — keys
//     map 1:1 to paths:
//       "uploads/<name>"    -> db/uploads/<name>
//       "backups/<file>"    -> db/backups/<file>
// ============================================================

type R2BucketLike = {
  put(key: string, value: ArrayBuffer | Uint8Array | string): Promise<unknown>;
  get(key: string): Promise<{ arrayBuffer(): Promise<ArrayBuffer> } | null>;
  delete(key: string): Promise<unknown>;
  list(opts: { prefix: string }): Promise<{ objects: Array<{ key: string }> }>;
};

type D1StatementLike = {
  bind(...values: unknown[]): D1StatementLike;
  run(): Promise<unknown>;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
};

type D1DatabaseLike = {
  prepare(sql: string): D1StatementLike;
};

function cfEnv(): Record<string, unknown> | null {
  try {
    return getCloudflareContext().env as Record<string, unknown>;
  } catch {
    return null; // not running on Workers
  }
}

function r2Bucket(): R2BucketLike | null {
  return (cfEnv()?.BAHAR_FILES as R2BucketLike | undefined) ?? null;
}

function d1Database(): D1DatabaseLike | null {
  return (cfEnv()?.DB as D1DatabaseLike | undefined) ?? null;
}

let fileBlobReady: Promise<void> | null = null;

function ensureFileBlobTable(d1: D1DatabaseLike): Promise<void> {
  if (!fileBlobReady) {
    fileBlobReady = d1
      .prepare(
        'CREATE TABLE IF NOT EXISTS "FileBlob" ("key" TEXT NOT NULL PRIMARY KEY, "data" BLOB NOT NULL, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)'
      )
      .run()
      .then(() => undefined)
      .catch((e) => {
        fileBlobReady = null;
        throw e;
      });
  }
  return fileBlobReady;
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
  const d1 = d1Database();
  if (d1) {
    await ensureFileBlobTable(d1);
    const bytes = typeof data === "string" ? new TextEncoder().encode(data) : new Uint8Array(data);
    await d1
      .prepare('INSERT OR REPLACE INTO "FileBlob" ("key", "data", "updatedAt") VALUES (?1, ?2, CURRENT_TIMESTAMP)')
      .bind(key, bytes.buffer as ArrayBuffer)
      .run();
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
  const d1 = d1Database();
  if (d1) {
    await ensureFileBlobTable(d1);
    const row = await d1.prepare('SELECT "data" FROM "FileBlob" WHERE "key" = ?1').bind(key).first<{ data: ArrayBuffer }>();
    return row ? new Uint8Array(row.data) : null;
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
  const d1 = d1Database();
  if (d1) {
    await ensureFileBlobTable(d1);
    await d1.prepare('DELETE FROM "FileBlob" WHERE "key" = ?1').bind(key).run();
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
  const d1 = d1Database();
  if (d1) {
    await ensureFileBlobTable(d1);
    const res = await d1
      .prepare('SELECT "key" FROM "FileBlob" WHERE "key" LIKE ?1')
      .bind(`${prefix}%`)
      .all<{ key: string }>();
    return res.results.map((r) => r.key.slice(prefix.length)).filter((n) => n && !n.includes("/"));
  }
  try {
    return await fs.readdir(path.join(process.cwd(), "db", ...prefix.split("/")));
  } catch {
    return [];
  }
}
