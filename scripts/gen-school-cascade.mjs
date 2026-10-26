// Generate school-deletion cascade lists from prisma/schema.prisma
import fs from "fs";
const schema = fs.readFileSync("prisma/schema.prisma", "utf8");
const modelRe = /^model (\w+) \{([\s\S]*?)^\}/gm;
const bySchool = [], byStudent = [], byClass = [], byUser = [];
let m;
while ((m = modelRe.exec(schema))) {
  const name = m[1]; const body = m[2];
  const camel = name[0].toLowerCase() + name.slice(1);
  const scalarRe = /^\s+(\w+)\s+(\w+)(\?)?\s/gm; const types = {}; let s;
  while ((s = scalarRe.exec(body))) types[s[1]] = { type: s[2], opt: !!s[3] };
  if (camel === "school" || camel === "auditLog" || camel === "setting" || camel === "backup" || camel === "loginEvent") continue;
  if (types.schoolId) bySchool.push({ t: camel, opt: types.schoolId.opt });
  if (types.studentId) byStudent.push(camel);
  if (types.classId) byClass.push(camel);
}
console.log("// bySchool (direct schoolId column):", JSON.stringify(bySchool));
console.log("// byStudent (direct studentId column):", JSON.stringify(byStudent));
console.log("// byClass (direct classId column):", JSON.stringify(byClass));
