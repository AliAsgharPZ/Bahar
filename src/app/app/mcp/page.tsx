"use client";

import { PageHeader } from "@/components/shared/bits";
import { Terminal } from "lucide-react";

const READ_TOOLS = [
  "mcp_list_schools", "mcp_list_students", "mcp_list_classes", "mcp_get_attendance",
  "mcp_list_grades", "mcp_get_wallet", "mcp_list_dormitory_assignments",
  "mcp_list_shop_products", "mcp_list_announcements", "mcp_list_tasks",
];
const WRITE_TOOLS = ["mcp_create_announcement", "mcp_create_task", "mcp_record_attendance"];

export default function McpPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="سرور MCP بهار" desc="تا ایجنت‌ها با سامانه کار کنند — با همان نشست و نقش کاربر، بدون توکن یا میان‌بر تازه." />
      <div className="b-card p-6 flex flex-col gap-3">
        <b className="text-[14px]">نقطهٔ اتصال</b>
        <p className="text-[13px] text-steel">
          نشانی سرور: <b dir="ltr">/api/mcp</b> — پروتکل JSON-RPC 2.0.
          احراز هویت دقیقاً با همان کوکی نشست بهار انجام می‌شود؛ ایجنت باید با همان حساب وارد شده باشد.
          بدون نشست معتبر، همهٔ ابزارها خطای احراز هویت می‌دهند و هیچ داده‌ای برنمی‌گردد.
          داده همیشه به مدرسهٔ همان کاربر محدود است و دانش‌آموز/ولی فقط دادهٔ خودش یا فرزندانش را می‌بیند.
        </p>
        <pre className="b-card p-4 text-[12px] overflow-x-auto" dir="ltr">{`{
  "jsonrpc": "2.0", "id": 1, "method": "tools/call",
  "params": { "name": "mcp_list_students", "arguments": { "limit": 20 } }
}`}</pre>
      </div>
      <div className="grid lg:grid-cols-2 gap-4 items-start">
        <div className="b-card p-6 flex flex-col gap-1">
          <b className="text-[14px] mb-2">ابزارهای خواندنی</b>
          {READ_TOOLS.map((t) => <code key={t} className="text-[12.5px] py-1 border-b border-hairline last:border-0" dir="ltr">{t}</code>)}
        </div>
        <div className="b-card p-6 flex flex-col gap-1">
          <b className="text-[14px] mb-2">ابزارهای نوشتنی (فقط نقش‌های مجاز همان عملیات)</b>
          {WRITE_TOOLS.map((t) => <code key={t} className="text-[12.5px] py-1 border-b border-hairline last:border-0" dir="ltr">{t}</code>)}
          <p className="text-[12.5px] text-steel mt-2">ثبت حضور فقط برای معلم/مدیر/معاون؛ اطلاعیه و تسک فقط برای کادر مدرسه. هیچ ابزار نوشتنی برای نقش دانش‌آموز/ولی باز نیست.</p>
        </div>
      </div>
      <div className="b-card p-6 flex flex-col gap-2">
        <b className="text-[14px] flex items-center gap-2"><Terminal className="w-4 h-4" /> نکته برای ایجنت‌ها</b>
        <p className="text-[13px] text-steel">اول <code dir="ltr">initialize</code> را بفرستید، بعد <code dir="ltr">tools/list</code>، بعد <code dir="ltr">tools/call</code>. اگر پاسخ «NO_SCHOOL» گرفتید، یعنی حساب به مدرسه‌ای وصل نیست؛ سوپرادمین می‌تواند schoolId را در آرگومان بدهد.</p>
      </div>
    </div>
  );
}
