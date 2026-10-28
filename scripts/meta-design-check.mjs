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

// ---- v2 tag scan (fixes a v1 flaw): the old regexes stopped at the
// first ">" — which is the ">" in an onClick arrow ("=>") that appears
// BEFORE className in most tags — so they flagged buttons/inputs that
// DO carry b-btn/b-input later in the same tag. This scanner respects
// {} nesting and quotes, so a tag ends only at a ">" at brace depth 0.
function scanTags(src, name) {
  const out = [];
  let i = 0;
  for (;;) {
    const j = src.indexOf("<" + name, i);
    if (j < 0) break;
    const k = j + 1 + name.length;
    if (k < src.length && ![" ", "\t", "\n", "/", ">"].includes(src[k])) { i = j + 1; continue; }
    let depth = 0, inDq = false, inSq = false, p = k, done = false;
    while (p < src.length) {
      const c = src[p];
      if (inDq) { if (c === '"') inDq = false; }
      else if (inSq) { if (c === "'") inSq = false; }
      else if (c === '"') inDq = true;
      else if (c === "'") inSq = true;
      else if (c === "{") depth++;
      else if (c === "}") depth = Math.max(0, depth - 1);
      else if (c === ">" && depth === 0) { out.push(src.slice(j, p + 1)); done = true; break; }
      p++;
    }
    i = done ? p + 1 : p + 1;
  }
  return out;
}

// Structural tokens that are Meta language even though they are not
// b-btn: pill tabs, badges, card-as-button, option rows, promo blocks,
// circular icon buttons and aria-labelled icon buttons.
const BTN_OK = ["b-btn", "b-pill-tab", "b-badge", "b-card", "b-option", "b-promo", "rounded-full", "aria-label"];
// tv is a full-screen display and messages is a chat layout: neither
// uses PageHeader by design, so they are not violations.
const NO_HEADER_PAGES = new Set(["tv/page.tsx", "messages/page.tsx"]);

const files = walk(ROOT);
const rows = [];
for (const f of files) {
  const s = readFileSync(f, "utf8");
  const rel = f.replace(ROOT + "/", "");
  const violations = [];
  if (f.endsWith("/page.tsx") && !s.includes("PageHeader") && !NO_HEADER_PAGES.has(rel)) violations.push("missing PageHeader");
  const rawBtn = scanTags(s, "button").filter((t) => t.includes("className") && !BTN_OK.some((tok) => t.includes(tok)));
  if (rawBtn.length) violations.push(`raw <button> without a Meta token (${rawBtn.length})`);
  const rawInp = scanTags(s, "input").filter((t) => !t.includes("b-input") && !/type="(checkbox|radio|hidden|file|color)"/.test(t));
  if (rawInp.length) violations.push(`raw <input> without b-input (${rawInp.length})`);
  if (/<select(?![^>]*b-input)/.test(s)) violations.push("raw <select> without b-input");
  const hexes = [...s.matchAll(/#[0-9a-fA-F]{3,8}\b/g)].map((m) => m[0]);
  if (hexes.length) violations.push(`hard-coded colors: ${[...new Set(hexes)].join(", ")}`);
  if (s.includes("rounded-none") || s.includes("rounded-sm")) violations.push("squared corners (Meta uses pills/24-32px cards)");
  rows.push({ file: rel, violations });
}
const bad = rows.filter((r) => r.violations.length);
if (process.argv.includes("--json")) {
  console.log(JSON.stringify({ total: rows.length, withViolations: bad.length, rows: bad }, null, 2));
} else {
  console.log(`pages: ${rows.length}, with violations: ${bad.length}`);
  for (const r of bad) console.log(`- ${r.file}: ${r.violations.join("; ")}`);
}
