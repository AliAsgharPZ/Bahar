import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

const SECURITY_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "img-src 'self' data: blob: https:",
      "media-src 'self' blob: data:",
      "style-src 'self' 'unsafe-inline'",
      "font-src 'self' data:",
      `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
      "connect-src 'self' https: wss: http://127.0.0.1:8787 http://localhost:8787",
      "frame-ancestors 'self'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  output: "standalone",
  // The Prisma client engine loads its query compiler from a .wasm file at
  // runtime; make sure Next's output tracing ships it with the server bundle
  // (required for the Cloudflare Workers build).
  outputFileTracingIncludes: {
    "/**": [
      "./node_modules/.prisma/client/*.wasm",
      "./src/generated/prisma/**/*.wasm",
      // nft traces @libsql/client's node entry only; OpenNext resolves the
      // workerd entry (lib-esm/web.js) when bundling for Workers, so the web
      // build must be force-included or packaging fails with
      // 'Could not resolve "@libsql/client"'.
      "./node_modules/@libsql/client/lib-esm/web.js",
      // Same workerd-entry tracing gap across the libsql + Prisma client
      // packages: nft follows node conditions, OpenNext bundles with
      // workerd conditions. Force-include every script file of those
      // packages (binaries excluded by the extensions) so whichever entry
      // the workerd resolution picks is present in the trace.
      "./node_modules/@libsql/client/**/*.js",
      "./node_modules/@libsql/client/**/*.mjs",
      "./node_modules/@libsql/client/**/*.cjs",
      "./node_modules/@libsql/client/**/*.json",
      "./node_modules/@libsql/core/**/*.js",
      "./node_modules/@libsql/core/**/*.mjs",
      "./node_modules/@libsql/core/**/*.cjs",
      "./node_modules/@libsql/hrana-client/**/*.js",
      "./node_modules/@libsql/hrana-client/**/*.mjs",
      "./node_modules/@libsql/hrana-client/**/*.cjs",
      "./node_modules/@libsql/isomorphic-ws/**/*.mjs",
      "./node_modules/@libsql/isomorphic-ws/**/*.cjs",
      "./node_modules/@libsql/isomorphic-ws/**/*.json",
      "./node_modules/@prisma/client/**/*.js",
      "./node_modules/@prisma/client/**/*.mjs",
      "./node_modules/@prisma/client/**/*.cjs",
      "./node_modules/@prisma/client/**/*.json",
    ],
  },
  reactStrictMode: false,
  poweredByHeader: false,
  // Type checking is enforced by a standalone `tsc --noEmit` gate before every
  // push (always green). Next's in-build TypeScript phase runs a second full
  // type-check that OOMs (exit 137) in memory-constrained build containers —
  // it killed three consecutive Cloudflare builds (2026-10-26/27) — so the
  // in-build pass is disabled here; compile (SWC) is unaffected.
  typescript: { ignoreBuildErrors: true },
  // Shrink the module graph the bundler has to hold in memory.
  experimental: {
    optimizePackageImports: ["lucide-react", "recharts", "date-fns"],
    // Cloudflare's build containers OOM-kill `next build` (exit 137) on this
    // ~105-route app: fewer parallel build workers + memory-optimized
    // compilation lower the peak RSS below the container ceiling.
    webpackMemoryOptimizations: true,
    cpus: 2,
  },
  // The production build runs through webpack (Next 16's default Turbopack
  // builder OOM-kills on this app in CI containers — diagnosed 2026-10-27 by
  // local reproduction: Turbopack died at "Creating an optimized production
  // build" with exit 137 on an 8 GB machine, while webpack completes).
  // Prisma's D1 client imports its query engine as a .wasm module; webpack
  // needs async WebAssembly enabled to bundle it.
  webpack: (config) => {
    config.experiments = { ...config.experiments, asyncWebAssembly: true };
    // Resolve "workerd" export conditions: packages like @libsql/client ship
    // a pure-JS web build under the workerd condition and a native-binding
    // build under node. The Workers bundle must get the web build — the
    // native one crashes the whole worker at startup ("Neon: unsupported
    // architecture", diagnosed locally in workerd 2026-10-27), and the
    // node-condition file set is also what output tracing copies, which
    // OpenNext's workerd-conditioned bundling then cannot resolve.
    const conds = config.resolve.conditionNames ?? [];
    if (!conds.includes("workerd")) config.resolve.conditionNames = [...conds, "workerd"];
    return config;
  },
  async headers() {
    return [
      { source: "/(.*)", headers: SECURITY_HEADERS },
    ];
  },
  async redirects() {
    return [
      { source: "/introduce", destination: "/plans", permanent: true },
    ];
  },
};

export default nextConfig;
