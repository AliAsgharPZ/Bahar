#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""بهار | تضمین import isDemoUser در همه فایل‌های گاردشده"""
import glob
import re

files = [f.replace("\\", "/") for f in glob.glob("src/app/api/**/route.ts", recursive=True)]

fixed = 0
for path in files:
    with open(path, encoding="utf-8") as fh:
        content = fh.read()
    if "isDemoUser(me)" not in content:
        continue
    if re.search(r"\bisDemoUser\b[^=]*[,}]\s*$", content) is None and "import" in content:
        pass
    # already imported?
    if re.search(r"import\s*(type\s*)?\{[^}]*\bisDemoUser\b[^}]*\}\s*from\s*\"@/lib/api\"", content, re.S):
        continue

    # try appending to an existing @/lib/api import (single or multiline)
    m = re.search(r"(import\s*(?:type\s*)?\{)([^}]*?)(\}\s*from\s*\"@/lib/api\";)", content)
    if m:
        inner = m.group(2).rstrip()
        sep = "" if inner.endswith(",") else ","
        new = f"{m.group(1)}{inner}{sep} isDemoUser, apiErr {m.group(3)}"
        if "apiErr" in inner:
            new = f"{m.group(1)}{inner}{sep} isDemoUser {m.group(3)}"
        content = content.replace(m.group(0), new, 1)
    else:
        # insert a fresh import after the last top import
        lines = content.split("\n")
        last_import = 0
        for i, l in enumerate(lines):
            if l.startswith(("import ", "} from", "  ", "\t")) and ("from" in l or l.startswith("import")):
                if l.startswith("import ") or l.startswith("} from"):
                    last_import = i
        lines.insert(last_import + 1, 'import { isDemoUser, apiErr } from "@/lib/api";')
        content = "\n".join(lines)

    with open(path, "w", encoding="utf-8") as fh:
        fh.write(content)
    fixed += 1
    print("fixed import:", path)

print(f"\n{fixed} files fixed.")
