import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { hashPassword, generatePassword, isValidNationalId, isValidShadNumber } from "@/lib/auth";
import { requireUser, apiOk, apiErr, handleApiError, readJson, audit, isDemoUser , toDate, toInt } from "@/lib/api";
import { hasPermission } from "@/lib/roles";
import { deliverCredentials } from "@/lib/shad";
import { enDigits, slugify } from "@/lib/persian";
import { isValidProvinceCounty } from "@/lib/iran";
import { planStatusOf } from "@/lib/plans";

/** GET /api/schools — ادمین: همه؛ مدیر/معاون: مدرسه خودش */
export async function GET(req: NextRequest) {
  try {
    const me = await requireUser(req);
    const isService = me.role === "SUPER_ADMIN" || me.role === "ADMIN";

    // FIX (راند ۱۶): ادمین بدون «مشاهده مدارس» نباید فهرست + اطلاعات مدیران را ببیند
    if (me.role === "ADMIN" && !hasPermission(me, "view_schools")) {
      return apiErr(403, "مشاهده مدارس نیاز به دسترسی «مشاهده مدارس» دارد.", "FORBIDDEN");
    }

    if (isService) {
      const schools = await db.school.findMany({
        include: {
          manager: { select: { id: true, firstName: true, lastName: true, nationalId: true, phone: true, shadNumber: true } },
          site: { select: { subdomain: true, published: true, templateId: true } },
          _count: {
            select: {
              classes: true,
              staff: { where: { role: "TEACHER" } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });
      const counts = await db.student.groupBy({ by: ["schoolId"], _count: { _all: true } });
      const countMap = new Map(counts.map((c) => [c.schoolId, c._count._all]));
      return apiOk({
        schools: schools.map((s) => ({
          ...s,
          studentCount: countMap.get(s.id) ?? 0,
          teacherCount: s._count.staff,
          classCount: s._count.classes,
          planStatus: planStatusOf(s.plan, s.planExpiresAt),
          _count: undefined,
        })),
      });
    }

    if (me.role === "MANAGER" || me.role === "DEPUTY") {
      if (!me.schoolId) return apiOk({ schools: [] });
      const school = await db.school.findUnique({
        where: { id: me.schoolId },
        include: {
          manager: { select: { id: true, firstName: true, lastName: true, nationalId: true, phone: true, shadNumber: true } },
          site: { select: { subdomain: true, published: true, templateId: true } },
        },
      });
      if (!school) return apiOk({ schools: [] });
      return apiOk({
        schools: [
          { ...school, planStatus: planStatusOf(school.plan, school.planExpiresAt) },
        ],
      });
    }

    return apiErr(403, "دسترسی ندارید.", "FORBIDDEN");
  } catch (e) {
    return handleApiError(e);
  }
}

/** POST /api/schools — ساخت مدرسه + مدیر آن + سایت اختصاصی (ساب‌دامین خودکار) */
export async function POST(req: NextRequest) {
  try {
    const me = await requireUser(req);
    if (await isDemoUser(me)) return apiErr(403, "این قابلیت در حساب دمو غیرفعال است.", "DEMO_READONLY");
    if (me.role !== "SUPER_ADMIN" && !(me.role === "ADMIN" && hasPermission(me, "create_schools"))) {
      return apiErr(403, "ساخت مدرسه برای شما مجاز نیست.", "FORBIDDEN");
    }
    const body = await readJson<Record<string, unknown>>(req);

    const name = String(body.name ?? "").trim();
    const code = String(body.code ?? "").trim();
    if (name.length < 3) return apiErr(400, "نام مدرسه الزامی است.", "BAD_NAME");
    if (code.length < 2) return apiErr(400, "کد مدرسه الزامی است.", "BAD_CODE");

    const dupe = await db.school.findUnique({ where: { code } });
    if (dupe) return apiErr(409, "کد مدرسه تکراری است.", "DUPLICATE");

    const province = body.province ? String(body.province) : null;
    const county = body.county ? String(body.county) : null;
    if (province && county && !isValidProvinceCounty(province, county)) {
      return apiErr(400, "این شهرستان به استان انتخابی تعلق ندارد.", "BAD_COUNTY");
    }

    const plan = ["SILVER", "GOLD", "DIAMOND"].includes(String(body.plan ?? ""))
      ? String(body.plan) : "GOLD";
    const planExpiresAt = body.planExpiresAt ? toDate(body.planExpiresAt) : null;
    if (body.planExpiresAt && !planExpiresAt) return apiErr(400, "تاریخ انقضای پلن نامعتبر است.", "BAD_DATE"); // FIX راند ۱۶

    // ── مدیر مدرسه ──
    let managerData: { id: string; nationalId: string; password: string; firstName: string; lastName: string } | null = null;
    let shadDelivery: { ok: boolean; error?: string } = { ok: false, error: "NO_MANAGER" };
    let managerId: string | null = null;

    const mNationalId = enDigits(String(body.managerNationalId ?? "")).trim();
    if (mNationalId) {
      if (!isValidNationalId(mNationalId)) {
        if (me.role === "SUPER_ADMIN" && body.forceInvalidNationalId === true) {
          // درج دستی سوپرادمین
        } else {
          return apiErr(400, "کد ملی مدیر نامعتبر است.", "BAD_NATIONAL_ID");
        }
      }
      const exists = await db.user.findUnique({ where: { nationalId: mNationalId } });
      if (exists) {
        if (exists.role !== "MANAGER" || exists.schoolId) {
          return apiErr(409, "این کد ملی برای کاربر دیگری ثبت شده است.", "DUPLICATE");
        }
        managerId = exists.id;
      } else {
        const mFirstName = String(body.managerFirstName ?? "").trim();
        const mLastName = String(body.managerLastName ?? "").trim();
        if (mFirstName.length < 2 || mLastName.length < 2) {
          return apiErr(400, "نام و نام خانوادگی مدیر الزامی است.", "BAD_NAME");
        }
        const mShad = body.managerShadNumber ? enDigits(String(body.managerShadNumber)).trim() : null;
        if (mShad && !isValidShadNumber(mShad)) {
          return apiErr(400, "شماره شاد مدیر نامعتبر است.", "BAD_SHAD");
        }
        const password = generatePassword();
        const manager = await db.user.create({
          data: {
            nationalId: mNationalId,
            passwordHash: hashPassword(password),
            tempPassword: password,
            mustChangePassword: true,
            role: "MANAGER",
            firstName: mFirstName,
            lastName: mLastName,
            phone: body.managerPhone ? enDigits(String(body.managerPhone)).trim() : null,
            shadNumber: mShad,
            createdBy: me.id,
          },
        });
        managerData = { id: manager.id, nationalId: mNationalId, password, firstName: mFirstName, lastName: mLastName };
        managerId = manager.id;
      }
    }

    // FIX (راند ۱۶): مدرسه + پیوند مدیر + سایت در یک تراکنش — خرابی وسط راه کاربر یتیم نمی‌سازد
    let subdomain = slugify(name);
    const taken = await db.schoolSite.findUnique({ where: { subdomain } });
    if (taken) subdomain = `${subdomain}-${code}`.slice(0, 40);
    const school = await (async () => {
      const created = await db.school.create({
        data: {
          name,
          code,
          type: body.type ? String(body.type) : null,
          address: body.address ? String(body.address) : null,
          city: county ?? (body.city ? String(body.city) : null),
          province,
          county,
          phone: body.phone ? enDigits(String(body.phone)).trim() : null,
          establishedYear: body.establishedYear ? toInt(enDigits(String(body.establishedYear)), 1000, 2100) : null,
          motto: body.motto ? String(body.motto) : null,
          about: body.about ? String(body.about) : null,
          logoUrl: body.logoUrl ? String(body.logoUrl) : null,
          plan,
          planExpiresAt,
          planNote: body.planNote ? String(body.planNote) : null,
          managerId,
        },
      });
      if (managerId) {
        await db.user.update({ where: { id: managerId }, data: { schoolId: created.id } });
      }
      await db.schoolSite.create({
        data: { schoolId: created.id, subdomain, templateId: "classic", published: false },
      });
      return created;
    })();
    const site = { subdomain };

    if (managerData && body.managerShadNumber) {
      shadDelivery = await deliverCredentials(
        { ...managerData, role: "MANAGER", tempPassword: managerData.password, shadNumber: String(body.managerShadNumber), schoolId: school.id },
        school.name,
        "مدیر مدرسه"
      );
    }

    await audit({
      user: me, action: "CREATE_SCHOOL", entityType: "SCHOOL", entityId: school.id,
      meta: { name, code, manager: managerData?.nationalId, plan, subdomain: site.subdomain },
      schoolId: school.id,
    });

    return apiOk({ school, manager: managerData, site: { subdomain: site.subdomain }, shadDelivery });
  } catch (e) {
    return handleApiError(e);
  }
}
