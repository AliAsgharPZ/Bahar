import { apiOk } from "@/lib/api";
import { SHIPPED_SUMMARIES } from "@/lib/country/shipped";
import { WORLD_COUNTRIES } from "@/lib/country/world";

/* بهار | بسته‌های کشورِ همراه سامانه + سطح پوشش واقعی هر بسته + فهرست نام همهٔ کشورهای جهان (فقط نام). */
export async function GET() {
  return apiOk({ packs: SHIPPED_SUMMARIES, world: WORLD_COUNTRIES });
}
