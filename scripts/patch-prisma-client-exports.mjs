// Reorder the generated Prisma client's package.json export conditions so
// "workerd" wins over "node" whenever a bundler resolves with both in its
// condition set (OpenNext's esbuild does). Without this, the Workers bundle
// loads the client's node entry, which reads the query-compiler .wasm from
// disk and compiles it with `new WebAssembly.Module(bytes)` — dynamic wasm
// compilation is forbidden on Workers, so every DB query would 500.
// Pure Node resolvers (standalone/dev) don't have "workerd" in their set
// and keep landing on the node entry, so this is safe everywhere.
import { readFileSync, writeFileSync } from "node:fs";

const path = new URL("../node_modules/.prisma/client/package.json", import.meta.url);
const pkg = JSON.parse(readFileSync(path, "utf8"));
const FIRST = ["workerd", "worker", "edge-light"];

function reorder(node) {
  if (Array.isArray(node)) return node.map(reorder);
  if (node && typeof node === "object") {
    const keys = Object.keys(node);
    const prioritized = [
      ...FIRST.filter((k) => keys.includes(k)),
      ...keys.filter((k) => !FIRST.includes(k)),
    ];
    const out = {};
    for (const k of prioritized) out[k] = reorder(node[k]);
    return out;
  }
  return node;
}

pkg.exports = reorder(pkg.exports);
pkg.imports = reorder(pkg.imports);
writeFileSync(path, JSON.stringify(pkg, null, 2));
console.log("prisma client exports: workerd prioritized");
