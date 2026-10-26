#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""بهار | افزودن گارد حساب دمو به همه APIهای نوشتن"""
import glob
import re

SKIP = {
    "src/app/api/auth/login/route.ts",
    "src/app/api/auth/logout/route.ts",
    "src/app/api/schools/[id]/enter/route.ts",
    "src/app/api/public/contact/route.ts",
    "src/app/api/public/school/[subdomain]/route.ts",
}

GUARD = '    if (await isDemoUser(me)) return apiErr(403, "این قابلیت در حساب دمو غیرفعال است.", "DEMO_READONLY");'

WRITE_FN = re.compile(r"^export async function (POST|PUT|DELETE|PATCH)\s*\(")
ANY_FN = re.compile(r"^export async function ")
ME_LINE = re.compile(r"^\s*const me = await (requireUser|requirePermission)\(")
API_IMPORT = re.compile(r"^import \{([^}]*)\} from \"@/lib/api\";")

files = [f.replace("\\", "/") for f in glob.glob("src/app/api/**/route.ts", recursive=True)]
files = [f for f in sorted(files) if f not in SKIP]

total = 0
for path in files:
    with open(path, encoding="utf-8") as fh:
        lines = fh.read().split("\n")

    out = []
    in_write = False
    inserted = False
    changed = False

    for line in lines:
        if ANY_FN.match(line):
            in_write = bool(WRITE_FN.match(line))
            inserted = False
        if in_write and not inserted and ME_LINE.match(line):
            out.append(line)
            out.append(GUARD)
            inserted = True
            changed = True
            continue
        out.append(line)

    if not changed:
        continue

    content = "\n".join(out)
    # ensure isDemoUser imported
    if "isDemoUser" not in content:
        m = None
        for pat in (API_IMPORT, API_IMPORT2):
            m = pat.search(content)
            if m:
                break
        if m:
            inner = m.group(1)
            new_inner = inner.rstrip() + ", isDemoUser " if not inner.strip().endswith(",") else inner.rstrip() + " isDemoUser"
            content = content.replace(m.group(0), 'import {%s} from "@/lib/api";' % new_inner, 1)
        else:
            # add new import after last import line
            last_import = 0
            for i, l in enumerate(content.split("\n")):
                if l.startswith("import "):
                    last_import = i
            ls = content.split("\n")
            ls.insert(last_import + 1, 'import { isDemoUser } from "@/lib/api";')
            content = "\n".join(ls)

    with open(path, "w", encoding="utf-8") as fh:
        fh.write(content)
    total += 1
    print(f"guarded: {path}")

print(f"\n{total} route files guarded.")
