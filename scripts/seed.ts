/**
 * بهار | Seed — داده اولیه نسخه نمایشی نهایی
 * اجرا: bun scripts/seed.ts
 */
import { PrismaClient } from "../src/generated/prisma-node/client";
import { hashPassword, generatePassword } from "../src/lib/auth";

const db = new PrismaClient();

/** تولید کد ملی معتبر با رقم کنترل */
function makeNationalId(base9: string): string {
  const digits = base9.padStart(9, "0").slice(0, 9).split("").map(Number);
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += digits[i] * (10 - i);
  const rem = sum % 11;
  const check = rem < 2 ? rem : 11 - rem;
  return base9.padStart(9, "0") + String(check);
}

const pw = () => generatePassword(10);

async function main() {
  console.log("🌱 پاک‌سازی دیتابیس…");
  await db.$transaction([
    db.auditLog.deleteMany(),
    db.shadOutbox.deleteMany(),
    db.shadSession.deleteMany(),
    db.message.deleteMany(),
    db.announcement.deleteMany(),
    db.schoolEvent.deleteMany(),
    db.gradeRecord.deleteMany(),
    db.attendance.deleteMany(),
    db.assignment.deleteMany(),
    db.scheduleSlot.deleteMany(),
    db.teachingAssignment.deleteMany(),
    db.studentParent.deleteMany(),
    db.student.deleteMany(),
    db.subject.deleteMany(),
    db.class.deleteMany(),
    db.school.deleteMany(),
    db.user.deleteMany(),
  ]);

  const created: Array<{ nationalId: string; password: string; name: string; role: string }> = [];

  async function createUser(data: {
    nationalId: string; firstName: string; lastName: string; role: string;
    fatherName?: string; gender?: string; birthYear?: number; shadNumber?: string;
    phone?: string; education?: string; fieldOfStudy?: string; jobTitle?: string;
    permissions?: string[]; schoolId?: string | null; address?: string;
  }) {
    const password = pw();
    const user = await db.user.create({
      data: {
        nationalId: data.nationalId,
        passwordHash: hashPassword(password),
        tempPassword: password,
        mustChangePassword: true,
        role: data.role,
        permissions: JSON.stringify(data.permissions ?? []),
        firstName: data.firstName,
        lastName: data.lastName,
        fatherName: data.fatherName ?? null,
        gender: data.gender ?? null,
        birthDate: data.birthYear ? new Date(Date.UTC(data.birthYear, 5, 1)) : null,
        shadNumber: data.shadNumber ?? null,
        phone: data.phone ?? null,
        education: data.education ?? null,
        fieldOfStudy: data.fieldOfStudy ?? null,
        jobTitle: data.jobTitle ?? null,
        address: data.address ?? null,
        schoolId: data.schoolId ?? null,
      },
    });
    created.push({ nationalId: data.nationalId, password, name: `${data.firstName} ${data.lastName}`, role: data.role });
    return { user, password };
  }

  // ────────────── سرویس ──────────────
  console.log("👑 ادمین ارشد و ادمین سرویس…");
  const superAdmin = await createUser({
    nationalId: makeNationalId("100000001"),
    firstName: "سارا", lastName: "محمدی", role: "SUPER_ADMIN",
    gender: "FEMALE", birthYear: 1985, shadNumber: "09120000001",
    education: "کارشناسی ارشد مدیریت فناوری اطلاعات", address: "تهران، ونک",
  });
  const serviceAdmin = await createUser({
    nationalId: makeNationalId("100000002"),
    firstName: "رضا", lastName: "کریمی", role: "ADMIN",
    gender: "MALE", birthYear: 1990, shadNumber: "09120000002",
    education: "کارشناسی نرم‌افزار",
  });

  // ────────────── مدرسه ۱ ──────────────
  console.log("🏫 مدرسه ۱…");
  const manager1 = await createUser({
    nationalId: makeNationalId("200000001"),
    firstName: "مریم", lastName: "احمدی", role: "MANAGER",
    gender: "FEMALE", birthYear: 1978, shadNumber: "09120000010",
    education: "کارشناسی ارشد مدیریت آموزشی", fatherName: "حسن",
  });
  const school1 = await db.school.create({
    data: {
      name: "دبیرستان نمونه دولتی بهار",
      code: "BH-1001",
      type: "دولتی (نمونه)",
      city: "تهران", province: "تهران",
      address: "تهران، خیابان بهار، کوچه شکوفه، شماره ۱۰",
      phone: "02188000001",
      establishedYear: 1392,
      managerId: manager1.user.id,
    },
  });
  await db.user.update({ where: { id: manager1.user.id }, data: { schoolId: school1.id } });

  const deputy1 = await createUser({
    nationalId: makeNationalId("200000002"),
    firstName: "علی", lastName: "رضایی", role: "DEPUTY",
    gender: "MALE", birthYear: 1988, shadNumber: "09120000011",
    education: "کارشناسی ریاضی", fatherName: "محمود",
    permissions: ["manage_students", "take_attendance", "enter_grades", "manage_events", "manage_announcements", "view_school_reports"],
    schoolId: school1.id,
  });

  // ── درس‌ها ──
  const subjectNames = ["ریاضی", "فیزیک", "شیمی", "ادبیات فارسی", "زبان انگلیسی", "زیست‌شناسی", "عربی", "دین و زندگی", "تربیت بدنی"];
  const subjects: Record<string, { id: string }> = {};
  for (const name of subjectNames) {
    const s = await db.subject.create({
      data: { schoolId: school1.id, name, weeklyHours: name === "تربیت بدنی" ? 2 : 3, grade: "دهم/یازدهم" },
    });
    subjects[name] = s;
  }

  // ── معلمان ──
  console.log("👩‍🏫 معلمان…");
  const teacherDefs = [
    { first: "نرگس", last: "حسینی", subj: "ریاضی", gender: "FEMALE" as const, shad: "09120000101" },
    { first: "حسین", last: "موسوی", subj: "فیزیک", gender: "MALE" as const, shad: "09120000102" },
    { first: "فاطمه", last: "صادقی", subj: "شیمی", gender: "FEMALE" as const, shad: "09120000103" },
    { first: "محمد", last: "قاسمی", subj: "ادبیات فارسی", gender: "MALE" as const, shad: "09120000104" },
    { first: "زهرا", last: "نوری", subj: "زبان انگلیسی", gender: "FEMALE" as const, shad: "09120000105" },
    { first: "سینا", last: "رحیمی", subj: "زیست‌شناسی", gender: "MALE" as const, shad: "09120000106" },
    { first: "لیلا", last: "کاظمی", subj: "عربی", gender: "FEMALE" as const, shad: "09120000107" },
    { first: "امیر", last: "طاهری", subj: "تربیت بدنی", gender: "MALE" as const, shad: "09120000108" },
    { first: "مهناز", last: "سلمانی", subj: "دین و زندگی", gender: "FEMALE" as const, shad: "09120000109" },
  ];
  const teachers: Array<{ id: string; subj: string; name: string }> = [];
  for (let i = 0; i < teacherDefs.length; i++) {
    const t = teacherDefs[i];
    const { user } = await createUser({
      nationalId: makeNationalId(`3000000${String(i + 1).padStart(2, "0")}`),
      firstName: t.first, lastName: t.last, role: "TEACHER",
      gender: t.gender, birthYear: 1990 + i, shadNumber: t.shad,
      education: "کارشناسی", fieldOfStudy: t.subj,
      permissions: ["take_attendance", "enter_grades", "manage_assignments"],
      schoolId: school1.id,
    });
    teachers.push({ id: user.id, subj: t.subj, name: `${t.first} ${t.last}` });
  }

  // ── کلاس‌ها ──
  console.log("班级 کلاس‌ها…");
  const classDefs = [
    { name: "دهم ریاضی ۱", grade: "دهم", field: "ریاضی", room: "۱۰۱", teacher: 0 },
    { name: "دهم تجربی ۱", grade: "دهم", field: "تجربی", room: "۱۰۲", teacher: 1 },
    { name: "یازدهم ریاضی ۱", grade: "یازدهم", field: "ریاضی", room: "۲۰۱", teacher: 2 },
  ];
  const classes: Array<{ id: string; name: string }> = [];
  for (const c of classDefs) {
    const cls = await db.class.create({
      data: {
        schoolId: school1.id, name: c.name, grade: c.grade, field: c.field,
        academicYear: "1404-1405", capacity: 28, roomNumber: c.room,
        homeroomTeacherId: teachers[c.teacher].id,
      },
    });
    classes.push({ id: cls.id, name: c.name });
  }

  // ── تخصیص معلمان به کلاس‌ها ──
  for (const t of teachers) {
    for (const c of classes) {
      await db.teachingAssignment.create({
        data: { schoolId: school1.id, teacherId: t.id, classId: c.id, subjectId: subjects[t.subj].id, academicYear: "1404-1405" },
      });
    }
  }

  // ── برنامه هفتگی کلاس ۱ ──
  console.log("📅 برنامه هفتگی…");
  const timetable: Record<number, string[]> = {
    1: ["ریاضی", "فیزیک", "ادبیات فارسی", "زبان انگلیسی"],
    2: ["شیمی", "ریاضی", "زیست‌شناسی", "عربی"],
    3: ["ادبیات فارسی", "دین و زندگی", "فیزیک", "تربیت بدنی"],
    4: ["زبان انگلیسی", "زیست‌شناسی", "ریاضی", "شیمی"],
    5: ["عربی", "دین و زندگی", "تربیت بدنی", "ادبیات فارسی"],
  };
  for (const [day, periods] of Object.entries(timetable)) {
    for (let p = 0; p < periods.length; p++) {
      const subjName = periods[p];
      const teacher = teachers.find((t) => t.subj === subjName)!;
      await db.scheduleSlot.create({
        data: {
          classId: classes[0].id, dayOfWeek: Number(day), period: p + 1,
          subjectId: subjects[subjName].id, teacherId: teacher.id,
        },
      });
    }
  }
  // کلاس ۲ و ۳ هم برنامه ساده
  for (let ci = 1; ci < 3; ci++) {
    for (let day = 1; day <= 5; day++) {
      for (let p = 1; p <= 4; p++) {
        const subjName = ["ریاضی", "فیزیک", "ادبیات فارسی", "شیمی"][(day + p) % 4];
        const teacher = teachers.find((t) => t.subj === subjName)!;
        await db.scheduleSlot.create({
          data: {
            classId: classes[ci].id, dayOfWeek: day, period: p,
            subjectId: subjects[subjName].id, teacherId: teacher.id,
          },
        });
      }
    }
  }

  // ── دانش‌آموزان + اولیا ──
  console.log("🎒 دانش‌آموزان و اولیا…");
  const studentFirstM = ["امیرحسین", "پارسا", "محمدعلی", "آرش", "کیان", "سامان", "مهراد", "آرمین", "بردیا", "رادین"];
  const studentFirstF = ["ستایش", "نیکا", "آیدا", "مهسا", "یاسمن", "ترمه", "رها", "سمیرا", "درسا", "هستی"];
  const lastNames = ["رضایی", "کریمی", "موسوی", "حسینی", "صادقی", "نوری", "قاسمی", "کاظمی", "رحیمی", "طاهری", "ملکی", "شریفی", "مرادی", "بهرامی", "افشار", "سلطانی", "یزدانی", "فراهانی", "امینی", "خسروی"];
  const fatherJobs = ["مهندس عمران", "پزشک", "کارمند بانک", "راننده", "معلم", "حسابدار", "کارآفرین", "برق‌کار", "پرستار", "آزاد"];
  const motherJobs = ["معلم", "پرستار", "خانه‌دار", "پزشک", "طراح گرافیک", "خانه‌دار", "کارمند", "خانه‌دار", "خیاط", "صیدل"];
  const parentEdu = ["دیپلم", "کارشناسی", "کارشناسی ارشد", "دیپلم", "کارشناسی", "کارشناسی", "دکتری", "کارشناسی ارشد", "دیپلم", "کارشناسی"];

  let seq = 0;
  const studentRecords: Array<{ studentId: string; userId: string; classIdx: number; name: string; nationalId: string }> = [];
  for (let ci = 0; ci < classes.length; ci++) {
    const count = ci === 0 ? 10 : ci === 1 ? 8 : 7;
    for (let si = 0; si < count; si++) {
      seq++;
      const isMale = si % 2 === 0;
      const first = isMale ? studentFirstM[si % 10] : studentFirstF[si % 10];
      const last = lastNames[(seq - 1) % 20];
      const studentNational = makeNationalId(`500${String(seq).padStart(6, "0")}`);
      const shad = `0913${String(100000 + seq).slice(1)}`;
      const { user } = await createUser({
        nationalId: studentNational, firstName: first, lastName: last, role: "STUDENT",
        gender: isMale ? "MALE" : "FEMALE", birthYear: ci === 2 ? 2008 : 2009,
        shadNumber: shad, fatherName: fatherJobs ? undefined : undefined,
        schoolId: school1.id, address: "تهران، منطقه ۵",
      });
      const student = await db.student.create({
        data: {
          userId: user.id, schoolId: school1.id, classId: classes[ci].id,
          studentNumber: String(1200 + seq), entryYear: "1404",
        },
      });
      studentRecords.push({ studentId: student.id, userId: user.id, classIdx: ci, name: `${first} ${last}`, nationalId: studentNational });

      // پدر همه + مادر ۴ نفر اول کلاس ۱
      const fatherNational = makeNationalId(`600${String(seq).padStart(6, "0")}`);
      const fatherShad = `0914${String(100000 + seq).slice(1)}`;
      const { user: father } = await createUser({
        nationalId: fatherNational, firstName: ["محمود", "جواد", "اکبر", "رسول", "حمید", "بابک", "فرهاد", "نادر", "ایرج", "کامران"][(seq - 1) % 10],
        lastName: last, role: "PARENT",
        gender: "MALE", shadNumber: fatherShad,
        jobTitle: fatherJobs[(seq - 1) % 10], education: parentEdu[(seq - 1) % 10],
        schoolId: school1.id, phone: fatherShad,
      });
      await db.studentParent.create({
        data: { studentId: student.id, parentUserId: father.id, relation: "FATHER", isPrimary: true },
      });

      if (ci === 0 && si < 4) {
        const motherNational = makeNationalId(`700${String(seq).padStart(6, "0")}`);
        const motherShad = `0915${String(100000 + seq).slice(1)}`;
        const { user: mother } = await createUser({
          nationalId: motherNational, firstName: ["مهری", "زهرا", "سمیه", "نازنین", "شیرین", "لیلا", "مینا", "پروین", "سلما", "غزل"][(seq - 1) % 10],
          lastName: last, role: "PARENT",
          gender: "FEMALE", shadNumber: motherShad,
          jobTitle: motherJobs[(seq - 1) % 10], education: parentEdu[(seq + 3) % 10],
          schoolId: school1.id, phone: motherShad,
        });
        await db.studentParent.create({
          data: { studentId: student.id, parentUserId: mother.id, relation: "MOTHER", isPrimary: true },
        });
      }
    }
  }

  // ── حضور و غیاب ۱۰ روز اخیر (کلاس ۱) ──
  console.log("✅ حضور و غیاب…");
  const today = new Date();
  const statuses = ["PRESENT", "PRESENT", "PRESENT", "PRESENT", "ABSENT", "PRESENT", "LATE", "PRESENT", "EXCUSED", "PRESENT"];
  for (let d = 1; d <= 10; d++) {
    const date = new Date(today.getTime() - d * 24 * 3600 * 1000);
    // کلید شمسی از Intl
    const fmt = new Intl.DateTimeFormat("en-US-u-ca-persian", { year: "numeric", month: "numeric", day: "numeric" });
    const parts = fmt.formatToParts(date);
    const y = parts.find((p) => p.type === "year")?.value ?? "1404";
    const m = parts.find((p) => p.type === "month")?.value ?? "1";
    const dd = parts.find((p) => p.type === "day")?.value ?? "1";
    const key = `${y}-${String(m).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
    const class1Students = studentRecords.filter((s) => s.classIdx === 0);
    for (let i = 0; i < class1Students.length; i++) {
      await db.attendance.create({
        data: {
          studentId: class1Students[i].studentId, classId: classes[0].id,
          date: key, status: statuses[(i + d) % statuses.length],
          recordedById: teachers[0].id,
        },
      });
    }
  }

  // ── نمرات (کلاس ۱، نیمسال ۱) ──
  console.log("📊 نمرات…");
  const gradeKinds = ["QUIZ", "MIDTERM", "FINAL"];
  const class1Students = studentRecords.filter((s) => s.classIdx === 0);
  const gradeSubjects = ["ریاضی", "فیزیک", "ادبیات فارسی", "شیمی", "زبان انگلیسی"];
  for (const subjName of gradeSubjects) {
    for (let i = 0; i < class1Students.length; i++) {
      for (let k = 0; k < gradeKinds.length; k++) {
        const base = 12 + ((i * 7 + k * 5 + subjName.length * 3) % 8); // 12..19
        await db.gradeRecord.create({
          data: {
            studentId: class1Students[i].studentId,
            subjectId: subjects[subjName].id,
            classId: classes[0].id, term: 1, kind: gradeKinds[k],
            score: Math.min(20, base + 0.5), maxScore: 20,
            weight: gradeKinds[k] === "FINAL" ? 2 : 1,
            enteredById: teachers.find((t) => t.subj === subjName)!.id,
          },
        });
      }
    }
  }

  // ── تکالیف ──
  console.log("📝 تکالیف…");
  const assignmentDefs = [
    { class: 0, subj: "ریاضی", title: "تمرین‌های فصل ۲ (معادله خط)", days: 3 },
    { class: 0, subj: "فیزیک", title: "آزمایش ساده حرکت شناسی", days: 5 },
    { class: 0, subj: "ادبیات فارسی", title: "خلاصه‌نویسی داستان «گرگ‌ها می‌گریسند»", days: 2 },
    { class: 1, subj: "شیمی", title: "پروژه جدول تناوبی", days: 7 },
    { class: 2, subj: "ریاضی", title: "حل ۲۰ مسئله مثلثات", days: 4 },
  ];
  for (const a of assignmentDefs) {
    const teacher = teachers.find((t) => t.subj === a.subj)!;
    await db.assignment.create({
      data: {
        classId: classes[a.class].id, subjectId: subjects[a.subj].id,
        teacherId: teacher.id, title: a.title,
        description: `لطفاً تکلیف «${a.title}» را تا مهلت مقرر آماده کنید و در کلاس تحویل دهید. برای هماهنگی گروهی می‌توانید از پیام‌رسان شاد استفاده کنید.`,
        dueDate: new Date(Date.now() + a.days * 24 * 3600 * 1000),
      },
    });
  }

  // ── رویدادها ──
  console.log("🎉 رویدادها…");
  const eventDefs = [
    { title: "جلسه انجمن اولیا و مربیان", desc: "بررسی عملکرد نیمسال اول و انتخاب انجمن", days: 6, kind: "MEETING", audience: "PARENTS" },
    { title: "آغاز امتحانات میان‌ترم", desc: "برنامه امتحانات در تابلو اعلانات و بخش رویدادها قرار می‌گیرد", days: 12, kind: "EXAM", audience: "STUDENTS" },
    { title: "گردش علمی موزه ملی", desc: "گردش علمی پایه دهم — پذیرش با هماهنگی معاونت", days: 20, kind: "TRIP", audience: "ALL" },
    { title: "کارگاه مهارت مطالعه", desc: "ویژه دانش‌آموزان یازدهم", days: 9, kind: "WORKSHOP", audience: "CLASS", class: 2 },
    { title: "مراسم گرامیداشت روز معلم", desc: "با حضور اولیا و دانش‌آموزان", days: -3, kind: "CEREMONY", audience: "ALL" },
    { title: "جلسه هماهنگی معلمان", desc: "مرور برنامه هفتگی نیمسال دوم", days: 2, kind: "MEETING", audience: "TEACHERS" },
  ];
  for (const e of eventDefs) {
    await db.schoolEvent.create({
      data: {
        schoolId: school1.id, title: e.title, description: e.desc,
        startAt: new Date(Date.now() + e.days * 24 * 3600 * 1000),
        endAt: e.days > 0 ? new Date(Date.now() + (e.days + 1) * 24 * 3600 * 1000) : null,
        kind: e.kind, audience: e.audience,
        classId: e.audience === "CLASS" ? classes[e.class!].id : null,
        createdById: manager1.user.id,
      },
    });
  }

  // ── اطلاعیه‌ها ──
  const annDefs = [
    { title: "ثبت‌نام کلاس‌های تقویتی نیمسال دوم", body: "از اولیا محترم تقاضا می‌شود تا پایان هفته نسبت به ثبت‌نام فرزندانشان در کلاس‌های تقویتی ریاضی و فیزیک اقدام فرمایند. ظرفیت محدود است.", roles: "PARENT", pinned: true },
    { title: "تغییر زمان زنگ تفریح", body: "از شنبه آینده، زنگ تفریح اول ۵ دقیقه طولانی‌تر خواهد شد.", roles: "", pinned: false },
    { title: "هماهنگی پوشیدن لباس فرم", body: "مراقبت از لباس فرم مدرسه الزامی است؛ لطفاً نام دانش‌آموز روی لباس درج شود.", roles: "STUDENT", pinned: false },
  ];
  for (const a of annDefs) {
    await db.announcement.create({
      data: {
        schoolId: school1.id, title: a.title, body: a.body,
        audienceRoles: JSON.stringify(a.roles ? [a.roles] : []), pinned: a.pinned, createdById: manager1.user.id,
      },
    });
  }

  // ── پیام‌های داخلی ──
  console.log("💬 پیام‌ها…");
  const t0 = teachers[0]; // نرگس حسینی — ریاضی
  const msgs = [
    { from: manager1.user.id, to: t0.id, body: "سلام خانم حسینی، برگه نمرات ریاضی کلاس دهم تا فردا ثبت شود لطفاً." },
    { from: t0.id, to: manager1.user.id, body: "سلام، حتماً مدیر جان. فقط دو نمره باقی مانده." },
    { from: t0.id, to: studentRecords[0].userId, body: "سلام، تکلیف فصل ۲ را فراموش نکنید؛ سه روز مهلت دارید." },
  ];
  for (const m of msgs) {
    await db.message.create({
      data: { senderId: m.from, recipientId: m.to, body: m.body },
    });
  }
  // یک پیام از والد به معلم
  const fatherOfFirst = await db.studentParent.findFirst({
    where: { studentId: studentRecords[0].studentId, relation: "FATHER" },
  });
  if (fatherOfFirst) {
    await db.message.create({
      data: {
        senderId: fatherOfFirst.parentUserId, recipientId: t0.id,
        body: "سلام. وقت بخیر. درباره کلاس تقویتی ریاضی فرزندم می‌خواستم هماهنگ کنم.",
      },
    });
  }

  // ── صف اعتبارنامه‌های شاد (در انتظار اتصال حساب مدیر) ──
  console.log("🌷 صف اعتبارنامه‌های شاد…");
  let sentCount = 0;
  for (const u of created) {
    const user = await db.user.findUnique({ where: { nationalId: u.nationalId } });
    if (!user?.shadNumber || !user.tempPassword || !user.schoolId) continue;
    await db.shadOutbox.create({
      data: {
        schoolId: user.schoolId,
        recipientUserId: user.id, recipientName: u.name,
        recipientShadNumber: user.shadNumber,
        body: [
          "🌷 بهار | سامانه مدیریت مدرسه",
          "🏫 دبیرستان نمونه دولتی بهار",
          "",
          `${u.name} عزیز (${u.role === "STUDENT" ? "دانش‌آموز" : u.role === "PARENT" ? "ولی دانش‌آموز" : u.role === "TEACHER" ? "معلم" : u.role === "MANAGER" ? "مدیر مدرسه" : u.role === "DEPUTY" ? "معاون" : "کاربر"})،`,
          "حساب کاربری شما ایجاد شد:",
          `🆔 نام کاربری (کد ملی): ${u.nationalId}`,
          `🔑 رمز عبور: ${u.password}`,
          "",
          "برای امنیت بیشتر، پس از ورود اول رمز عبور را تغییر دهید.",
        ].join("\n"),
        purpose: "CREDENTIALS", status: "QUEUED",
      },
    });
    sentCount++;
  }

  // ────────────── مدرسه ۲ ──────────────
  console.log("🏫 مدرسه ۲…");
  const manager2 = await createUser({
    nationalId: makeNationalId("800000001"),
    firstName: "مهدی", lastName: "یزدانی", role: "MANAGER",
    gender: "MALE", birthYear: 1980, shadNumber: "09170000001",
    education: "کارشناسی ارشد فیزیک",
  });
  const school2 = await db.school.create({
    data: {
      name: "دبیرستان غیرانتفاعی نور",
      code: "NR-2002",
      type: "غیرانتفاعی",
      city: "شیراز", province: "فارس",
      phone: "07137000002",
      establishedYear: 1398,
      managerId: manager2.user.id,
    },
  });
  await db.user.update({ where: { id: manager2.user.id }, data: { schoolId: school2.id } });

  const s2Subject = await db.subject.create({ data: { schoolId: school2.id, name: "ریاضی", weeklyHours: 3 } });
  const s2Teacher = await createUser({
    nationalId: makeNationalId("810000001"),
    firstName: "شیما", lastName: "افشار", role: "TEACHER",
    gender: "FEMALE", birthYear: 1992, shadNumber: "09170000002",
    education: "کارشناسی ریاضی", permissions: ["take_attendance", "enter_grades"],
    schoolId: school2.id,
  });
  const s2Class = await db.class.create({
    data: { schoolId: school2.id, name: "نهم الف", grade: "نهم", field: null, academicYear: "1404-1405", capacity: 25, homeroomTeacherId: s2Teacher.user.id },
  });
  await db.teachingAssignment.create({
    data: { schoolId: school2.id, teacherId: s2Teacher.user.id, classId: s2Class.id, subjectId: s2Subject.id, academicYear: "1404-1405" },
  });
  for (let i = 1; i <= 5; i++) {
    const st = await createUser({
      nationalId: makeNationalId(`8200000${String(i).padStart(2, "0")}`),
      firstName: ["آرمان", "نیما", "غزل", "کیانا", "بردیا"][i - 1],
      lastName: ["شریفی", "مرادی", "امینی", "خسروی", "فراهانی"][i - 1],
      role: "STUDENT", gender: i % 2 ? "MALE" : "FEMALE", birthYear: 2010,
      shadNumber: `09170000${String(10 + i).padStart(2, "0")}`,
      schoolId: school2.id,
    });
    await db.student.create({
      data: { userId: st.user.id, schoolId: school2.id, classId: s2Class.id, studentNumber: String(300 + i), entryYear: "1404" },
    });
  }

  // ── لاگ‌های نمونه ──
  await db.auditLog.createMany({
    data: [
      { userId: superAdmin.user.id, userName: "سارا محمدی", action: "SEED_SYSTEM", entityType: "SYSTEM", meta: JSON.stringify({ schools: 2 }), createdAt: new Date() },
      { userId: manager1.user.id, userName: "مریم احمدی", action: "CREATE_STUDENT", entityType: "STUDENT", schoolId: school1.id, createdAt: new Date(Date.now() - 3600 * 1000) },
    ],
  });

  // ────────────── حساب‌های دمو — فقط با SEED_DEMO=1 (هرگز در production) ──────────────
  const DEMO_PASSWORD = process.env.SEED_DEMO === "1" ? "demo1234" : null;
  const demoTargets = DEMO_PASSWORD ? created.filter(
    (c) => c.nationalId === "2000000010" || c.nationalId === "5000000013"
  ) : [];
  for (const d of demoTargets) {
    await db.user.update({
      where: { nationalId: d.nationalId },
      data: {
        passwordHash: hashPassword(DEMO_PASSWORD),
        tempPassword: DEMO_PASSWORD,
        mustChangePassword: false,
      },
    });
    d.password = DEMO_PASSWORD as string;
  }
  if (DEMO_PASSWORD) console.warn("⚠ SEED_DEMO=1: demo accounts use the public password 'demo1234' — never in production.");

  console.log("✅ Seed کامل شد.");
  console.log("──────────────────────────────────");
  console.log("🔑 نام کاربری همه کاربران = کد ملی. رمزهای اولیه:");
  const demoRoles = ["SUPER_ADMIN", "ADMIN", "MANAGER", "DEPUTY", "TEACHER", "STUDENT", "PARENT"];
  for (const r of demoRoles) {
    const u = created.filter((c) => c.role === r).slice(0, r === "STUDENT" || r === "PARENT" ? 1 : r === "MANAGER" ? 2 : r === "TEACHER" ? 1 : 2);
    for (const x of u) {
      console.log(`  [${r}] ${x.name} — ${x.nationalId} / ${x.password}`);
    }
  }
  console.log(`اعتبارنامه‌های در صف شاد: ${sentCount}`);
  console.log(`کاربران: ${await db.user.count()} | دانش‌آموزان: ${await db.student.count()} | پیام‌ها: ${await db.message.count()}`);
}

// ============================================================
// داده نمونه نسخه نهایی — امکانات، نظرسنجی، گواهی، تسک، خانه‌ها
// ============================================================
async function seedFinalExtras() {
  const school = await db.school.findFirst({ where: { code: "BH-1001" } });
  if (!school) return;
  const schoolId = school.id;
  const students = await db.student.findMany({ where: { schoolId }, include: { user: true }, take: 30 });
  const teachers = await db.user.findMany({ where: { schoolId, role: "TEACHER" }, take: 8 });
  const manager = await db.user.findFirst({ where: { schoolId, role: "MANAGER" } });
  if (!students.length || !manager) return;

  // خانه‌ها
  const houses = await Promise.all([
    db.house.upsert({ where: { schoolId_name: { schoolId, name: "خانه بهار" } }, update: {}, create: { schoolId, name: "خانه بهار", color: "#00825e", motto: "رویش" } }),
    db.house.upsert({ where: { schoolId_name: { schoolId, name: "خانه تابستان" } }, update: {}, create: { schoolId, name: "خانه تابستان", color: "#f2a918", motto: "درخشش" } }),
    db.house.upsert({ where: { schoolId_name: { schoolId, name: "خانه پاییز" } }, update: {}, create: { schoolId, name: "خانه پاییز", color: "#e5548b", motto: "باروری" } }),
    db.house.upsert({ where: { schoolId_name: { schoolId, name: "خانه زمستان" } }, update: {}, create: { schoolId, name: "خانه زمستان", color: "#1a7fd4", motto: "استقامت" } }),
  ]);
  for (let i = 0; i < students.length; i++) {
    await db.student.update({ where: { id: students[i].id }, data: { houseId: houses[i % 4].id, tags: JSON.stringify(i % 7 === 0 ? ["نیازمند پیگیری"] : i % 5 === 0 ? ["ممتاز"] : []) } });
  }

  // اتاق‌ها و دارایی‌ها
  const roomNames = [["۱۰۱", "CLASSROOM", 32], ["۱۰۲", "CLASSROOM", 30], ["آزمایشگاه فیزیک", "LAB", 24], ["سالن ورزش", "SPORT", 120], ["کتابخانه", "LIBRARY", 40]] as const;
  for (const [name, kind, cap] of roomNames) {
    await db.room.upsert({ where: { schoolId_name: { schoolId, name } }, update: {}, create: { schoolId, name, kind, capacity: cap, floor: name.includes("۱۰") ? 1 : 0 } });
  }
  const assetDefs = [["پروژکتور اپسون", "AST-001", "PROJECTOR"], ["لپ‌تاپ لنوو ۱", "AST-002", "LAPTOP"], ["لپ‌تاپ لنوو ۲", "AST-003", "LAPTOP"], ["میکروفون بی‌سیم", "AST-004", "SOUND"]] as const;
  for (const [name, code, cat] of assetDefs) {
    await db.asset.upsert({ where: { schoolId_code: { schoolId, code } }, update: {}, create: { schoolId, name, code, category: cat, location: "دفتر مدیریت", status: "OK" } });
  }
  await db.maintenanceTicket.create({ data: { schoolId, title: "پروژکتور کلاس ۱۰۱ روشن نمی‌شود", priority: "HIGH", slaHours: 24, reportedById: teachers[0]?.id ?? manager.id, assetId: (await db.asset.findFirst({ where: { schoolId, code: "AST-001" } }))?.id } });

  // تگ‌ها + فیلد سفارشی
  await db.tagDef.upsert({ where: { schoolId_key: { schoolId, key: "needs_followup" } }, update: {}, create: { schoolId, key: "needs_followup", label: "نیازمند پیگیری", color: "#e41e3f" } });
  await db.tagDef.upsert({ where: { schoolId_key: { schoolId, key: "excellent" } }, update: {}, create: { schoolId, key: "excellent", label: "ممتاز", color: "#31a24c" } });
  await db.tagDef.upsert({ where: { schoolId_key: { schoolId, key: "transfer" } }, update: {}, create: { schoolId, key: "transfer", label: "انتقالی", color: "#1a7fd4" } });

  // اسناد نمونه
  for (const st of students.slice(0, 10)) {
    await db.studentDocument.upsert({ where: { studentId_kind: { studentId: st.id, kind: "BIRTH_CERT" } }, update: {}, create: { studentId: st.id, kind: "BIRTH_CERT", status: "RECEIVED", receivedAt: new Date(Date.now() - 90 * 86400000) } });
    if (Math.random() > 0.4) {
      await db.studentDocument.upsert({ where: { studentId_kind: { studentId: st.id, kind: "NATIONAL_ID" } }, update: {}, create: { studentId: st.id, kind: "NATIONAL_ID", status: "RECEIVED", receivedAt: new Date(Date.now() - 80 * 86400000) } });
    }
  }

  // اهداف و پورتفولیو
  await db.studentGoal.create({ data: { studentId: students[0].id, title: "رسیدن معدل به ۱۸", metric: "GPA", targetValue: "18", currentValue: "16.5", dueDate: new Date(Date.now() + 120 * 86400000) } });
  await db.portfolioItem.create({ data: { studentId: students[0].id, kind: "COMPETITION", title: "مدال برنز المپیاد ریاضی استان", description: "رتبه سوم استانی", date: new Date(Date.now() - 200 * 86400000) } });
  await db.portfolioItem.create({ data: { studentId: students[1]?.id ?? students[0].id, kind: "PROJECT", title: "ساخت ربات خط‌یاب", description: "پروژه باشگاه رباتیک" } });

  // نظرسنجی‌ها
  const poll1 = await db.poll.create({ data: { schoolId, question: "کیفیت غذای سلف این هفته چطور بود؟", audience: "ALL", createdById: manager.id, options: { create: [{ text: "عالی", sortOrder: 0 }, { text: "خوب", sortOrder: 1 }, { text: "متوسط", sortOrder: 2 }, { text: "نیاز به بهبود", sortOrder: 3 }] } } });
  for (let i = 0; i < 12; i++) {
    const u = students[i]?.userId;
    if (!u) break;
    const opts = await db.pollOption.findMany({ where: { pollId: poll1.id } });
    await db.pollVote.create({ data: { pollId: poll1.id, optionId: opts[i % 4].id, userId: u } }).catch(() => {});
  }
  await db.poll.create({ data: { schoolId, question: "کدام فعالیت فوق‌برنامه را می‌خواهید؟", audience: "STUDENTS", createdById: manager.id, options: { create: [{ text: "فوتبال", sortOrder: 0 }, { text: "شطرنج", sortOrder: 1 }, { text: "رباتیک", sortOrder: 2 }, { text: "تئاتر", sortOrder: 3 }] } } });

  // پیشنهادها
  await db.suggestion.create({ data: { schoolId, userId: null, body: "لطفاً ساعت زنگ تفریح کمی بیشتر شود؛ برای نماز و غذا وقت کم است.", category: "SERVICE", status: "REVIEWING" } });
  await db.suggestion.create({ data: { schoolId, userId: students[2]?.userId ?? null, body: "کلاس‌های تقویتی ریاضی قبل از امتحانات برگزار شود.", category: "EDUCATION", status: "NEW" } });

  // اتوماسیون پیش‌فرض
  await db.automationRule.create({ data: { schoolId, name: "هشدار غیبت مکرر", trigger: "ABSENT_THRESHOLD", config: JSON.stringify({ threshold: 5 }), action: "NOTIFY", actionConfig: JSON.stringify({ target: "MANAGER", title: "غیبت مکرر دانش‌آموز" }) } });
  await db.automationRule.create({ data: { schoolId, name: "تسک پیگیری افت نمره", trigger: "GRADE_DROP", config: JSON.stringify({ threshold: 4 }), action: "TASK", actionConfig: JSON.stringify({ priority: "HIGH" }) } });

  // تسک‌های نمونه
  await db.task.create({ data: { schoolId, title: "تماس با خانواده دانش‌آموزان غایب امروز", priority: "HIGH", assigneeId: manager.id, sourceKind: "MANUAL" } });
  await db.task.create({ data: { schoolId, title: "برنامه‌ریزی جلسه انجمن اولیا", priority: "NORMAL", status: "IN_PROGRESS", assigneeId: teachers[1]?.id ?? manager.id, dueDate: new Date(Date.now() + 5 * 86400000) } });
  await db.task.create({ data: { schoolId, title: "بررسی درخواست‌های انتقالی", priority: "NORMAL", studentId: students[0].id } });

  // قالب گواهی
  await db.certificateTemplate.create({ data: { schoolId, kind: "ENROLLMENT", title: "گواهی اشتغال به تحصیل", bodyTemplate: "گواهی می‌شود دانش‌آموز {{student_name}} فرزند {{father_name}} به کد ملی {{national_id}} و شماره دانش‌آموزی {{student_number}} در سال تحصیلی جاری در پایه {{grade}} کلاس {{class_name}} در این مدرسه مشغول به تحصیل است و این گواهی برای ارائه به مراجع ذی‌ربط صادر گردیده است.", footerNote: "این گواهی فاقد اعتبار پس از ابطال است." } });

  // تغییرات سرویس
  await db.changelogEntry.createMany({ data: [
    { version: "4.0", title: "نسخه نهایی بهار", body: "مرکز اقدامات، جستجوی سراسری ⌘K، پرونده ۳۶۰ درجه دانش‌آموز، کانبان تسک، اتوماسیون، امکانات، نظرسنجی، گواهی با استعلام QR، ایمپورت هوشمند، فونت آراد نسخه نقاط چسبیده، انیمیشن‌های کپسولی" },
    { version: "3.0", title: "تم تاریک، بلاگ، تیکت و سایت‌های مدرسه", body: "حالت شبانه کامل، بلاگ سرویس، مرکز پشتیبانی، سایت عمومی مدرسه با ۵ تمپلیت، اپ اندروید و ویندوز" },
  ] });

  // مهمان و اشیای گمشده
  await db.visitorLog.create({ data: { schoolId, name: "کارشناس اداره آموزش", purpose: "بازدید پیزشکی", hostName: "مدیر مدرسه", expected: true, expectedDate: new Date(), status: "EXPECTED", createdById: manager.id } });
  await db.lostFoundItem.create({ data: { schoolId, title: "کیف مدادی آبی", location: "سالن ورزش", foundAt: new Date(Date.now() - 2 * 86400000) } });

  // اعلان‌های نمونه برای مدیر
  await db.notification.createMany({ data: [
    { userId: manager.id, category: "URGENT", title: "۳ غیبت بدون توضیح", body: "امروز ۳ دانش‌آموز بدون ثبت دلیل غایب بوده‌اند.", link: "/app/attendance", kind: "ATTENDANCE" },
    { userId: manager.id, category: "IMPORTANT", title: "درخواست مرخصی جدید", body: "یک معلم درخواست مرخصی استعلاجی ثبت کرد.", link: "/app/leaves", kind: "SYSTEM" },
    { userId: manager.id, category: "SUCCESS", title: "۸۷٪ شهریه وصول شد", body: "وضعیت مالی این ماه بهتر از ماه گذشته است.", link: "/app/finance", kind: "FINANCE" },
  ] });

  // سوالات بانک نمونه
  const math = await db.subject.findFirst({ where: { schoolId, name: "ریاضی" } });
  if (math) {
    await db.question.createMany({ data: [
      { schoolId, subjectId: math.id, topic: "معادله خط", difficulty: "EASY", kind: "MULTI", body: "شیب خط y=2x+3 چند است؟", options: JSON.stringify(["۱", "۲", "۳", "۵"]), answer: "۲", createdById: teachers[0]?.id },
      { schoolId, subjectId: math.id, topic: "لگاریتم", difficulty: "MEDIUM", kind: "MULTI", body: "مقدار log(100) در پایه ۱۰ چند است؟", options: JSON.stringify(["۱", "۲", "۱۰", "۱۰۰"]), answer: "۲", createdById: teachers[0]?.id },
      { schoolId, subjectId: math.id, topic: "مثلثات", difficulty: "HARD", kind: "SHORT", body: "حاصل sin²(x)+cos²(x) را اثبات کنید.", answer: "۱ — اتحاد فیثاغورسی", createdById: teachers[0]?.id },
    ] });
  }

  // منابع آموزشی
  await db.resourceLink.createMany({ data: [
    { schoolId, subjectId: math?.id, title: "آموزش لگاریتم — فرادرس", url: "https://faradars.org/courses/fvmath-logarithm", kind: "VIDEO", topic: "لگاریتم", addedById: teachers[0]?.id },
    { schoolId, title: "تمرین‌های المپیاد ریاضی", url: "https://www.imo-official.org", kind: "PRACTICE", addedById: manager.id },
  ] });

  console.log("✓ داده‌های نسخه نهایی (خانه/امکانات/نظرسنجی/اتوماسیون/گواهی/تسک) اضافه شد");
}

main()
  .then(() => seedFinalExtras())
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());


