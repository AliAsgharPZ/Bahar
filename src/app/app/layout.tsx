import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { verifyToken, SESSION_COOKIE_NAME } from "@/lib/auth";
import { parsePermissions } from "@/lib/roles";
import { avatarApiFields } from "@/lib/avatar";
import { AppShell } from "@/components/app-shell/app-shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE_NAME)?.value;
  const payload = token ? verifyToken(token) : null;
  if (!payload || typeof payload.sub !== "string") {
    redirect("/login");
  }

  const actingSchoolId = store.get("bahar_acting_school")?.value ?? null;

  const user = await db.user.findUnique({
    where: { id: payload.sub },
    select: {
      id: true, nationalId: true, role: true, permissions: true,
      firstName: true, lastName: true, schoolId: true,
      mustChangePassword: true, isActive: true, shadNumber: true, tokenVersion: true,
      langCode: true,
      profileImageType: true, photoUrl: true, avatarConfig: true,
      school: { select: { id: true, name: true, code: true, shadEnabled: true, custodianEnabled: true } },
    },
  });
  if (!user || !user.isActive) {
    redirect("/login");
  }
  // FIX (راند ۱۶): نشست باطل‌شده (خروج اجباری همه دستگاه‌ها) → ریدایرکت به‌موقع، نه ارور صفحه‌ها
  if (typeof payload.tv === "number" && user.tokenVersion !== payload.tv) {
    redirect("/login");
  }

  let actingSchoolName: string | null = null;
  let actingSchoolIdLive: string | null = null;
  let actingShadEnabled: boolean | null = null;
  let actingCustodianEnabled: boolean | null = null;
  if (actingSchoolId && (user.role === "SUPER_ADMIN" || user.role === "ADMIN")) {
    const acting = await db.school.findUnique({
      where: { id: actingSchoolId },
      select: { id: true, name: true, shadEnabled: true, custodianEnabled: true },
    });
    if (acting) {
      actingSchoolName = acting.name;
      actingSchoolIdLive = acting.id;
      actingShadEnabled = acting.shadEnabled;
      actingCustodianEnabled = acting.custodianEnabled;
    }
  }

  // راند ۱۸: ماژول‌های مدرسهٔ مؤثر (مدرسهٔ خود کاربر یا پنل فعال) — گیت‌های UI شاد/سرایدار
  const schoolModules = actingSchoolIdLive
    ? { shadEnabled: actingShadEnabled ?? true, custodianEnabled: actingCustodianEnabled ?? true }
    : user.school
      ? { shadEnabled: user.school.shadEnabled, custodianEnabled: user.school.custodianEnabled }
      : null;

  return (
    <AppShell
      user={{
        id: user.id,
        nationalId: user.nationalId,
        role: user.role,
        permissions: parsePermissions(user.permissions),
        firstName: user.firstName,
        lastName: user.lastName,
        mustChangePassword: user.mustChangePassword,
        schoolName: actingSchoolName ?? user.school?.name ?? null,
        actingSchoolId: actingSchoolIdLive,
        langCode: user.langCode,
        schoolModules,
        ...avatarApiFields(user),
      }}
    >
      {children}
    </AppShell>
  );
}
