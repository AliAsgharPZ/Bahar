import { PrismaClient } from '@/generated/prisma/client'
import { PrismaD1 } from '@prisma/adapter-d1'
import { PrismaLibSql } from '@prisma/adapter-libsql'
import { getCloudflareContext } from '@opennextjs/cloudflare'

// ============================================================
// Bahar | Prisma client.
//
// On Cloudflare Workers the database is a D1 binding named DB,
// reached through the D1 driver adapter (the binding only exists
// inside a request context, so the client is resolved lazily and
// cached per binding). Everywhere else the classic file-backed
// SQLite client from DATABASE_URL is used, exactly as before.
// ============================================================

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
  prismaD1: { binding: unknown; client: PrismaClient } | undefined
}

function fileClient(): PrismaClient {
  if (!globalForPrisma.prisma) {
    // With engineType "client" the file-backed client also goes through a
    // driver adapter; the database file comes from DATABASE_URL.
    const url = process.env.DATABASE_URL ?? 'file:./db/custom.db'
    globalForPrisma.prisma = new PrismaClient({
      adapter: new PrismaLibSql({ url }),
      log: ['error'],
    })
  }
  return globalForPrisma.prisma
}

function resolveClient(): PrismaClient {
  try {
    const env = getCloudflareContext().env as { DB?: unknown }
    if (env?.DB) {
      if (globalForPrisma.prismaD1?.binding !== env.DB) {
        globalForPrisma.prismaD1 = {
          binding: env.DB,
          client: new PrismaClient({
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            adapter: new PrismaD1(env.DB as any),
            log: ['error'],
          }),
        }
      }
      return globalForPrisma.prismaD1.client
    }
  } catch {
    // Not running inside a Cloudflare request context.
  }
  return fileClient()
}

// A lazy proxy keeps every existing `import { db }` call site working
// unchanged: the concrete client is picked on first property access.
export const db: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = resolveClient() as unknown as Record<string | symbol, unknown>
    const value = client[prop]
    return typeof value === 'function' ? (value as (...a: unknown[]) => unknown).bind(client) : value
  },
})
