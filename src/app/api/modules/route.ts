import { NextRequest } from "next/server";
import fs from "fs";
import path from "path";
import { requireUser, apiOk, apiErr, handleApiError, requireSchoolId } from "@/lib/api";

const CODES = ["edu", "att", "fin", "par", "health", "trans", "lib", "extra", "admin", "welfare", "tech", "events"] as const;
type Def = { slug: string; category: string; categoryCode: string; title: string; description: string; fields: string[]; roles: string[]; statuses: string[] };

const DESIGNED_FILES = ["designed-batch1.json", "designed-batch2.json", "designed-batch3.json", "designed-batch4.json", "designed-batch5.json", "designed-batch6.json", "designed-batch7.json", "designed-batch8.json"] as const;
function loadDesigned(): Def[] {
  let out: Def[] = [];
  for (const name of DESIGNED_FILES) {
    const file = path.join(process.cwd(), "src", "lib", "modules", name);
    out = out.concat(JSON.parse(fs.readFileSync(file, "utf-8")) as Def[]);
  }
  return out;
}

/** GET /api/modules?category=&q=&slug=&page= — ماژول‌های طراحی‌شده، صفحه‌بندی‌شده */
export async function GET(req: NextRequest) {
  try {
    const me = await requireUser(req);
    requireSchoolId(me);
    const p = req.nextUrl.searchParams;
    const slug = p.get("slug") ?? "";
    const category = p.get("category") ?? "";
    const q = (p.get("q") ?? "").trim();
    const page = Math.max(1, Number(p.get("page") ?? 1) || 1);
    const size = 50;
    const designed = loadDesigned();
    if (slug) {
      const found = designed.find((d) => d.slug === slug);
      if (found) return apiOk({ item: found });
      return apiErr(404, "ماژول یافت نشد.", "NOT_FOUND");
    }
    let all: Def[] = category && (CODES as readonly string[]).includes(category) ? designed.filter((d) => d.categoryCode === category) : [...designed];
    if (q) all = all.filter((d) => d.title.includes(q) || d.description.includes(q) || d.category.includes(q));
    const total = all.length;
    const items = all.slice((page - 1) * size, page * size);
    return apiOk({ total, page, size, items });
  } catch (e) {
    return handleApiError(e);
  }
}
