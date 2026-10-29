"use client";

import { PageHeader } from "@/components/shared/bits";
import { useLang } from "@/lib/i18n";
import { Terminal } from "lucide-react";

const READ_TOOLS = [
  "mcp_list_schools", "mcp_list_students", "mcp_list_classes", "mcp_get_attendance",
  "mcp_list_grades", "mcp_get_wallet", "mcp_list_dormitory_assignments",
  "mcp_list_shop_products", "mcp_list_announcements", "mcp_list_tasks",
];
const WRITE_TOOLS = ["mcp_create_announcement", "mcp_create_task", "mcp_record_attendance"];

export default function McpPage() {
  const { t } = useLang();
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("mcp.title")} desc={t("mcp.desc")} />
      <div className="b-card p-6 flex flex-col gap-3">
        <b className="text-[14px]">{t("mcp.endpoint.title")}</b>
        <p className="text-[13px] text-steel">
          {t("mcp.endpoint.label")} <b dir="ltr">/api/mcp</b> — {t("mcp.endpoint.proto")}
          {t("mcp.auth")}
          {t("mcp.noSession")}
          {t("mcp.scope")}
        </p>
        <pre className="b-card p-4 text-[12px] overflow-x-auto" dir="ltr">{`{
  "jsonrpc": "2.0", "id": 1, "method": "tools/call",
  "params": { "name": "mcp_list_students", "arguments": { "limit": 20 } }
}`}</pre>
      </div>
      <div className="grid lg:grid-cols-2 gap-4 items-start">
        <div className="b-card p-6 flex flex-col gap-1">
          <b className="text-[14px] mb-2">{t("mcp.tools.read")}</b>
          {READ_TOOLS.map((t) => <code key={t} className="text-[12.5px] py-1 border-b border-hairline last:border-0" dir="ltr">{t}</code>)}
        </div>
        <div className="b-card p-6 flex flex-col gap-1">
          <b className="text-[14px] mb-2">{t("mcp.tools.write")}</b>
          {WRITE_TOOLS.map((t) => <code key={t} className="text-[12.5px] py-1 border-b border-hairline last:border-0" dir="ltr">{t}</code>)}
          <p className="text-[12.5px] text-steel mt-2">{t("mcp.writeNote")}</p>
        </div>
      </div>
      <div className="b-card p-6 flex flex-col gap-2">
        <b className="text-[14px] flex items-center gap-2"><Terminal className="w-4 h-4" /> {t("mcp.agentNote.title")}</b>
        <p className="text-[13px] text-steel">{t("mcp.agentNote.first")}{" "}<code dir="ltr">initialize</code>{" "}{t("mcp.agentNote.afterInit")}{" "}<code dir="ltr">tools/list</code>{t("mcp.agentNote.afterList")}{" "}<code dir="ltr">tools/call</code>{t("mcp.agentNote.afterCall")}</p>
      </div>
    </div>
  );
}
