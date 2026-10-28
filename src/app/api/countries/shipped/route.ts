import { apiOk } from "@/lib/api";
import { SHIPPED_SUMMARIES } from "@/lib/country/shipped";

/* بهار | بسته‌های کشورِ همراه سامانه + سطح پوشش واقعی هر بسته. */
export async function GET() {
  return apiOk({ packs: SHIPPED_SUMMARIES });
}
