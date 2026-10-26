#!/usr/bin/env python3
# افزودن tKey به آیتم‌های NAV در app-shell.tsx
import re

path = "src/components/app-shell/app-shell.tsx"
src = open(path, encoding="utf-8").read()

href_to_key = {
    "/app": "shell.dashboard",
    "/app/schools": "nav.schools",
    "/app/users": "nav.users",
    "/app/students": "nav.students",
    "/app/classes": "nav.classes",
    "/app/subjects": "nav.subjects",
    "/app/schedule": "nav.schedule",
    "/app/attendance": "nav.attendance",
    "/app/grades": "nav.grades",
    "/app/assignments": "nav.assignments",
    "/app/tasks": "nav.tasks",
    "/app/behavior": "nav.behavior",
    "/app/badges": "nav.badges",
    "/app/question-bank": "nav.questionBank",
    "/app/resources": "nav.resources",
    "/app/automation": "nav.automation",
    "/app/facilities": "nav.facilities",
    "/app/engagement": "nav.engagement",
    "/app/certificates": "nav.certificates",
    "/app/reports": "nav.reports",
    "/app/finance": "nav.finance",
    "/app/meetings": "nav.meetings",
    "/app/leaves": "nav.leaves",
    "/app/events": "nav.events",
    "/app/announcements": "nav.announcements",
    "/app/leads": "nav.leads",
    "/app/website": "nav.website",
    "/app/messages": "nav.messages",
    "/app/shad": "nav.shad",
    "/app/tickets": "nav.tickets",
    "/app/approvals": "nav.approvals",
    "/app/blog": "nav.blog",
    "/app/children": "nav.children",
    "/app/audit": "nav.audit",
    "/app/settings": "settings.title",
    "/app/profile": "shell.profile",
}

count = 0
for href, key in href_to_key.items():
    # فقط خطوط NAV: { href: "...", label: ...
    pattern = re.compile(r'(\{ href: "' + re.escape(href) + r'", label: )("([^"]*)")')
    def repl(m):
        global count
        count += 1
        return f'{m.group(1)}{m.group(2)}, tKey: "{key}"'
    src = pattern.sub(repl, src, count=1)

open(path, "w", encoding="utf-8").write(src)
print(f"tKey added to {count} NAV items")
