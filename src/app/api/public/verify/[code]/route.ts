import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { apiOk, handleApiError } from "@/lib/api";

/** GET /api/public/verify/[code] — استعلام اصالت گواهی (عمومی، بدون لاگین) */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await ctx.params;
    const cert = await db.certificate.findUnique({
      where: { verifyCode: code.toUpperCase() },
      include: {
        school: { select: { name: true, province: true, county: true } },
        student: { include: { user: { select: { firstName: true, lastName: true } }, class: { select: { name: true } } } },
      },
    });
    if (!cert) {
      return apiOk({ valid: false, message: "گواهی با این کد یافت نشد." });
    }
    if (cert.revokedAt) {
      return apiOk({
        valid: false,
        revoked: true,
        message: "این گواهی باطل شده است.",
        certificate: { title: cert.title, serial: cert.serial, issuedAt: cert.issuedAt },
      });
    }
    return apiOk({
      valid: true,
      certificate: {
        title: cert.title,
        serial: cert.serial,
        issuedAt: cert.issuedAt,
        school: cert.school.name,
        student: `${cert.student.user.firstName} ${cert.student.user.lastName}`,
        class: cert.student.class?.name ?? null,
      },
    });
  } catch (e) {
    return handleApiError(e);
  }
}
