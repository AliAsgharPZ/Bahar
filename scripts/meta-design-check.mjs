// Bahar | Meta design conformance check (read-only audit, no changes).
// Meta language, Bahar colors: pill buttons (b-btn), 24-32px cards
// (b-card/b-card-md), shared PageHeader, token inputs (b-input) and
// no hard-coded hex colors in app pages (colors come from CSS vars).
// Usage: node scripts/meta-design-check.mjs [--json]
// Exit code 0 always: this is a report, not a gate, until the old
// pages are migrated one by one.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("../src/app/app", import.meta.url).pathname;

function walk(dir, out = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith(".tsx")) out.push(p);
  }
  return out;
}

const files = walk(ROOT);
const rows = [];
for (const f of files) {
  const s = readFileSync(f, "utf8");
  const isClient = s.startsWith('"use client"') || s.includes('"use client";');
  const violations = [];
  if (!s.includes("PageHeader") && !f.endsWith("/page.tsx")) { /* shared bits exempt */ }
  if (f.endsWith("/page.tsx") && !s.includes("PageHeader")) violations.push("missing PageHeader");
  if (/<button(?![^>]*b-btn)/.test(s)) violations.push("raw <button> without b-btn");
  const inputTags = [...s.matchAll(/<input[^>]*>/g)].map((m) => m[0]);
  if (inputTags.some((t) => !t.includes("b-input") && !/type="(checkbox|radio)"/.test(t))) violations.push("raw <input> without b-input");
  if (/<select(?![^>]*b-input)/.test(s)) violations.push("raw <select> without b-input");
  const hexes = [...s.matchAll(/#[0-9a-fA-F]{3,8}\b/g)].map((m) => m[0]);
  if (hexes.length) violations.push(`hard-coded colors: ${[...new Set(hexes)].join(", ")}`);
  if (s.includes("rounded-none") || s.includes("rounded-sm")) violations.push("squared corners (Meta uses pills/24-32px cards)");
  rows.push({ file: f.replace(ROOT + "/", ""), client: isClient, violations });
}
const bad = rows.filter((r) => r.violations.length);
if (process.argv.includes("--json")) {
  console.log(JSON.stringify({ total: rows.length, withViolations: bad.length, rows: bad }, null, 2));
} else {
  console.log(`pages: ${rows.length}, with violations: ${bad.length}`);
  for (const r of bad) console.log(`- ${r.file}: ${r.violations.join("; ")}`);
}
