// بهار | اعتبارسنجی بسته زبان یا کشور از روی فایل JSON
// استفاده:
//   bun scripts/validate-pack.ts lang   src/lib/langs/packs/ur.json
//   bun scripts/validate-pack.ts country src/lib/country/packs/de.json
// خروجی: شمارش کلیدها/استان‌ها + خطاها + هشدارها؛ کد خروج ۱ یعنی رد شد.
import { readFileSync } from "node:fs";
import { validateLanguagePack, validateLongPack, validateSitePack, CATALOG_KEYS, LONG_KEYS, SITE_KEYS } from "../src/lib/langs";
import { validateCountryPack } from "../src/lib/country/pack";

const [kind, file] = process.argv.slice(2);
if (!kind || !file || (kind !== "lang" && kind !== "country")) {
  console.error("Usage: bun scripts/validate-pack.ts <lang|country> <file.json>");
  process.exit(2);
}

let raw: unknown;
try {
  raw = JSON.parse(readFileSync(file, "utf8"));
} catch (e) {
  console.error("INVALID_JSON:", e instanceof Error ? e.message : String(e));
  process.exit(1);
}

if (kind === "lang") {
  const p = raw as Record<string, unknown>;
  const app = validateLanguagePack(p);
  const site = validateSitePack(p);
  const long = validateLongPack((p as Record<string, unknown>).longStrings);
  console.log(`code: ${p.code} | name(fa): ${p.name} | native: ${p.nativeName} | dir: ${p.direction}`);
  console.log(`app: ${app.stats.keyCount}/${CATALOG_KEYS.length} (${app.stats.coverage}%)`);
  console.log(`site: ${site.stats.keyCount}/${SITE_KEYS.length} (${site.stats.coverage}%)`);
  console.log(`long: ${long.stats.keyCount}/${LONG_KEYS.length} (${long.stats.coverage}%)`);
  if (app.errors.length) console.log("APP ERRORS:\n" + app.errors.map((e) => " - " + e).join("\n"));
  if (site.errors.length) console.log("SITE ERRORS:\n" + site.errors.map((e) => " - " + e).join("\n"));
  if (long.errors.length) console.log("LONG ERRORS:\n" + long.errors.map((e) => " - " + e).join("\n"));
  if (app.warnings.length) console.log("APP WARNINGS:\n" + app.warnings.map((e) => " - " + e).join("\n"));
  if (site.warnings.length) console.log("SITE WARNINGS:\n" + site.warnings.map((e) => " - " + e).join("\n"));
  if (long.warnings.length) console.log("LONG WARNINGS:\n" + long.warnings.map((e) => " - " + e).join("\n"));
  const ok = app.ok && site.ok && long.ok;
  console.log(ok ? "RESULT: PASS" : "RESULT: FAIL");
  process.exit(ok ? 0 : 1);
} else {
  const { profile, validation } = validateCountryPack(raw);
  console.log(`code: ${profile?.code ?? "?"} | regions: ${validation.stats.regions} | counties: ${validation.stats.counties} | cities: ${validation.stats.cities} | villages: ${validation.stats.villages} | bytes: ${validation.stats.bytes}`);
  if (validation.errors.length) console.log("ERRORS:\n" + validation.errors.map((e) => " - " + e).join("\n"));
  if (validation.warnings.length) console.log("WARNINGS:\n" + validation.warnings.map((e) => " - " + e).join("\n"));
  console.log(validation.ok ? "RESULT: PASS" : "RESULT: FAIL");
  process.exit(validation.ok ? 0 : 1);
}
