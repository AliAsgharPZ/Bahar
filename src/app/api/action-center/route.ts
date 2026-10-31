import { NextRequest } from "next/server";
import { parseActions } from "@/lib/minutes";
import { db } from "@/lib/db";
import { requireUser, apiOk, handleApiError , actingSchoolIdFor } from "@/lib/api";
import { todayJalali, toJalaliKey, jalaliParts } from "@/lib/persian";

/** GET /api/action-center — مرکز اقدامات: همه کارهای در انتظار کاربر در یک نگاه */
export async function GET(req: NextRequest) {
  try {
    const me = await requireUser(req);
    const isService = me.role === "SUPER_ADMIN" || me.role === "ADMIN";
    const actingSchoolId = actingSchoolIdFor(req, me);
    const schoolId = actingSchoolId ?? me.schoolId;

    const items: Array<{ key: string; title: string; description: string; count: number; href: string; severity: "URGENT" | "IMPORTANT" | "NORMAL"; icon: string }> = [];

    if (isService && !actingSchoolId) {
      const [openTickets, pendingChanges, failedOutbox, newBlogComments, newLeads] = await Promise.all([
        db.ticket.count({ where: { status: "OPEN" } }),
        db.profileChangeRequest.count({ where: { status: "PENDING" } }),
        db.shadOutbox.count({ where: { status: "FAILED" } }),
        db.blogComment.count({ where: { approved: false } }),
        db.schoolLead.count({ where: { status: "NEW" } }),
      ]);
      if (openTickets > 0) items.push({ key: "tickets", title: "تیکت‌های باز پشتیبانی", description: "پاسخ به مدارس", count: openTickets, href: "/app/tickets", severity: "IMPORTANT", icon: "LifeBuoy" });
      if (pendingChanges > 0) items.push({ key: "changes", title: "درخواست‌های تغییر مشخصات", description: "در انتظار تأیید", count: pendingChanges, href: "/app/approvals", severity: "NORMAL", icon: "ClipboardList" });
      if (failedOutbox > 0) items.push({ key: "outbox", title: "پیام‌های شاد ناموفق", description: "ارسال مجدد لازم", count: failedOutbox, href: "/app/shad", severity: "URGENT", icon: "Send" });
      if (newBlogComments > 0) items.push({ key: "comments", title: "دیدگاه‌های بلاگ", description: "در انتظار تأیید", count: newBlogComments, href: "/app/blog", severity: "NORMAL", icon: "Newspaper" });
      return apiOk({ items, needsAttention: items.filter((i) => i.severity === "URGENT") });
    }

    if (!schoolId) return apiOk({ items: [], needsAttention: [] });
    const school = await db.school.findUnique({ where: { id: schoolId }, select: { managerId: true } });

    const isManagerish = me.role === "MANAGER" || me.role === "DEPUTY" || (isService && actingSchoolId);
    const classRows = isManagerish ? await db.class.findMany({ where: { schoolId, isActive: true }, select: { id: true } }) : [];
    const ids = classRows.map((c) => c.id);

    if (isManagerish) {
      const [pendingChanges, openTickets, pendingLeaves, pendingMeetings, openMaintenance, overdueFees, pendingTasks, newLeads, expiringDocs] = await Promise.all([
        db.profileChangeRequest.count({ where: { status: "PENDING", user: { schoolId, role: { in: ["DEPUTY", "TEACHER", "STUDENT", "PARENT"] } } } }),
        db.ticket.count({ where: { status: "OPEN", user: { schoolId } } }),
        db.leaveRequest.count({ where: { schoolId, status: "PENDING" } }),
        db.meeting.count({ where: { schoolId, status: "PENDING" } }),
        db.maintenanceTicket.count({ where: { schoolId, status: { in: ["OPEN", "IN_PROGRESS"] } } }),
        db.studentFee.count({ where: { schoolId, status: "UNPAID", dueDate: { lt: new Date() } } }),
        db.task.count({ where: { schoolId, status: { in: ["TODO", "IN_PROGRESS"] }, OR: [{ assigneeId: me.id }, { assigneeId: null }] } }),
        db.schoolLead.count({ where: { schoolId, status: "NEW" } }),
        db.studentDocument.count({ where: { student: { schoolId }, status: "PENDING" } }),
      ]);
      // غایبان امروز که بررسی نشده‌اند
      const absentToday = await db.attendance.count({ where: { classId: { in: ids }, date: todayJalali(), status: "ABSENT", note: null } });

      if (absentToday > 0) items.push({ key: "absent", title: "غایبان امروز بدون توضیح", description: "ثبت دلیل غیبت یا تماس با خانواده", count: absentToday, href: "/app/attendance", severity: "URGENT", icon: "ClipboardCheck" });
      if (pendingLeaves > 0) items.push({ key: "leaves", title: "درخواست‌های مرخصی", description: "در انتظار پاسخ", count: pendingLeaves, href: "/app/leaves", severity: "IMPORTANT", icon: "CalendarOff" });
      if (pendingMeetings > 0) items.push({ key: "meetings", title: "درخواست‌های ملاقات", description: "والدین منتظر تأیید", count: pendingMeetings, href: "/app/meetings", severity: "IMPORTANT", icon: "Handshake" });
      if (pendingChanges > 0) items.push({ key: "changes", title: "تغییرات مشخصات", description: "در انتظار تأیید", count: pendingChanges, href: "/app/approvals", severity: "NORMAL", icon: "ClipboardList" });
      if (openMaintenance > 0) items.push({ key: "maintenance", title: "خرابی‌های باز", description: "تعمیرات در انتظار", count: openMaintenance, href: "/app/facilities?tab=maintenance", severity: "IMPORTANT", icon: "Wrench" });
      if (overdueFees > 0) items.push({ key: "fees", title: "شهریه‌های سررسیدگذشته", description: "پیگیری مالی", count: overdueFees, href: "/app/finance", severity: "URGENT", icon: "Wallet" });
      if (pendingTasks > 0) items.push({ key: "tasks", title: "تسک‌های من", description: "در جریان", count: pendingTasks, href: "/app/tasks", severity: "NORMAL", icon: "ListTodo" });
      if (expiringDocs > 0) items.push({ key: "docs", title: "مدارک ناقص دانش‌آموزان", description: "چک‌لیست مدارک", count: expiringDocs, href: "/app/students", severity: "NORMAL", icon: "FileCheck" });
      if (newLeads > 0) items.push({ key: "leads", title: "پیش‌ثبت‌نام‌های جدید", description: "تماس با خانواده‌ها", count: newLeads, href: "/app/leads", severity: "NORMAL", icon: "CheckCheck" });
      if (openTickets > 0) items.push({ key: "tickets", title: "تیکت‌های پشتیبانی مدرسه", description: "پاسخ به کاربران", count: openTickets, href: "/app/tickets", severity: "NORMAL", icon: "LifeBuoy" });
    }

    if (me.role === "TEACHER") {
      const [missingAtt, pendingMeetings, myTasks, parentMsgs, pendingLeaves] = await Promise.all([
        db.scheduleSlot.findMany({ where: { teacherId: me.id }, select: { classId: true, dayOfWeek: true } }),
        db.meeting.count({ where: { staffId: me.id, status: "PENDING" } }),
        db.task.count({ where: { schoolId, status: { in: ["TODO", "IN_PROGRESS"] }, assigneeId: me.id } }),
        db.message.count({ where: { recipientId: me.id, readAt: null, sender: { role: "PARENT" } } }),
        db.leaveRequest.count({ where: { userId: me.id, status: "PENDING" } }),
      ]);
      // زنگ‌های امروز بدون ثبت حضور
      const { jalaliDayOfWeek } = await import("@/lib/persian");
      const todayDow = jalaliDayOfWeek();
      const todayClasses = new Set(missingAtt.filter((s) => s.dayOfWeek === todayDow).map((s) => s.classId));
      let notRecorded = 0;
      for (const cid of todayClasses) {
        const rec = await db.attendance.findFirst({ where: { classId: cid, date: todayJalali() } });
        if (!rec) notRecorded++;
      }
      if (notRecorded > 0) items.push({ key: "attendance", title: "حضورغیاب ثبت‌نشده", description: "کلاس‌های امروز", count: notRecorded, href: "/app/attendance", severity: "URGENT", icon: "ClipboardCheck" });
      if (pendingMeetings > 0) items.push({ key: "meetings", title: "درخواست ملاقات والدین", description: "در انتظار پاسخ", count: pendingMeetings, href: "/app/meetings", severity: "IMPORTANT", icon: "Handshake" });
      if (parentMsgs > 0) items.push({ key: "msgs", title: "پیام‌های والدین", description: "خوانده‌نشده", count: parentMsgs, href: "/app/messages", severity: "IMPORTANT", icon: "MessageCircle" });
      if (myTasks > 0) items.push({ key: "tasks", title: "تسک‌های من", description: "در جریان", count: myTasks, href: "/app/tasks", severity: "NORMAL", icon: "ListTodo" });
    }

    if (me.role === "PARENT") {
      const kids = await db.studentParent.findMany({ where: { parentUserId: me.id }, select: { studentId: true } });
      const kidIds = kids.map((k) => k.studentId);
      const [absentToday, pendingMeetings, unpaidFees, activePolls] = await Promise.all([
        db.attendance.count({ where: { studentId: { in: kidIds }, date: todayJalali(), status: "ABSENT" } }),
        db.meeting.count({ where: { requestedById: me.id, status: "PENDING" } }),
        db.studentFee.count({ where: { studentId: { in: kidIds }, status: "UNPAID", dueDate: { lt: new Date() } } }),
        db.poll.findMany({ where: { schoolId, active: true, audience: { in: ["ALL", "PARENTS"] } }, include: { votes: { where: { userId: me.id }, select: { id: true } } }, take: 10 }),
      ]);
      // نظرسنجی‌هایی که خودِ این کاربر در آن‌ها رأی نداده (نه نظرسنجی‌های بدون رأی)
      const notVoted = activePolls.filter((p) => p.votes.length === 0).length;
      if (absentToday > 0) items.push({ key: "absent", title: "غیبت فرزند شما امروز", description: "بررسی دلیل غیبت", count: absentToday, href: "/app/attendance", severity: "URGENT", icon: "ClipboardCheck" });
      if (unpaidFees > 0) items.push({ key: "fees", title: "شهریه سررسیدگذشته", description: "پرداخت", count: unpaidFees, href: "/app/finance", severity: "URGENT", icon: "Wallet" });
      if (notVoted > 0) items.push({ key: "polls", title: "نظرسنجی‌های بی‌پاسخ", description: "رأی شما ثبت نشده", count: notVoted, href: "/app/engagement?tab=polls", severity: "NORMAL", icon: "Vote" });
      if (pendingMeetings > 0) items.push({ key: "meetings", title: "ملاقات‌های در انتظار تأیید", description: "پیگیری", count: pendingMeetings, href: "/app/meetings", severity: "NORMAL", icon: "Handshake" });
    }

    if (me.role === "STUDENT") {
      const profile = await db.student.findFirst({ where: { userId: me.id } });
      if (profile) {
        const [openAssignments, activePolls, unreadMsgs] = await Promise.all([
          profile.classId
            ? db.assignment.count({ where: { classId: profile.classId, dueDate: { gte: new Date(Date.now() - 3 * 86400000) } } })
            : Promise.resolve(0),
          db.poll.findMany({ where: { schoolId, active: true, audience: { in: ["ALL", "STUDENTS"] } }, include: { votes: { where: { userId: me.id }, select: { id: true } } }, take: 10 }),
          db.message.count({ where: { recipientId: me.id, readAt: null } }),
        ]);
        // نظرسنجی‌هایی که خودِ این کاربر در آن‌ها رأی نداده
        const notVoted = activePolls.filter((p) => p.votes.length === 0).length;
        if (openAssignments > 0) items.push({ key: "assignments", title: "تکالیف نزدیک", description: "ددلاین در راه است", count: openAssignments, href: "/app/assignments", severity: "IMPORTANT", icon: "NotebookPen" });
        if (notVoted > 0) items.push({ key: "polls", title: "نظرسنجی‌های بی‌پاسخ", description: "رأی شما ثبت نشده", count: notVoted, href: "/app/engagement?tab=polls", severity: "NORMAL", icon: "Vote" });
        if (unreadMsgs > 0) items.push({ key: "msgs", title: "پیام‌های جدید", description: "خوانده‌نشده", count: unreadMsgs, href: "/app/messages", severity: "NORMAL", icon: "MessageCircle" });
      }
    }

    // اقدام‌های بازِ صورتجلسات که مسئولش خودِ کاربر است — اتصال ماژول صورتجلسات
    if (["MANAGER", "DEPUTY", "TEACHER", "ADMIN"].includes(me.role)) {
      const recentMinutes = await db.meetingMinute.findMany({ where: { schoolId }, orderBy: { date: "desc" }, take: 100, select: { actions: true } });
      let myOpenActions = 0;
      for (const m of recentMinutes) {
        for (const a of parseActions(m.actions)) if (a.ownerId === me.id && !a.done) myOpenActions++;
      }
      if (myOpenActions > 0) items.push({ key: "minuteActions", title: "اقدام‌های صورتجلسات من", description: "پیگیری مصوبات جلسات", count: myOpenActions, href: "/app/minutes", severity: "IMPORTANT", icon: "NotebookText" });
    }

    const sevRank = { URGENT: 0, IMPORTANT: 1, NORMAL: 2 } as const;
    items.sort((a, b) => sevRank[a.severity] - sevRank[b.severity] || b.count - a.count);

    return apiOk({
      items,
      needsAttention: items.filter((i) => i.severity === "URGENT"),
      today: todayJalali(),
    });
  } catch (e) {
    return handleApiError(e);
  }
}
