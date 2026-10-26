"use client";

import React from "react";

// ============================================================
// بهار | رندر مارک‌داون سبک — برای بلاگ و سند زبان طراحی
// پشتیبانی: هدینگ، پاراگراف، لیست، جدول، بولد، کد، نقل‌قول، خط جدا
// ============================================================

function renderInline(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  // **bold** و `code`
  const regex = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) nodes.push(<React.Fragment key={key++}>{text.slice(last, m.index)}</React.Fragment>);
    const token = m[0];
    if (token.startsWith("**")) {
      nodes.push(<b key={key++}>{token.slice(2, -2)}</b>);
    } else {
      nodes.push(
        <code key={key++} dir="ltr" className="font-mono text-[0.85em] bg-cloud rounded px-1.5 py-0.5 text-spring-deep">
          {token.slice(1, -1)}
        </code>
      );
    }
    last = m.index + token.length;
  }
  if (last < text.length) nodes.push(<React.Fragment key={key++}>{text.slice(last)}</React.Fragment>);
  return nodes;
}

export function Markdown({ source }: { source: string }) {
  const lines = source.split("\n");
  const blocks: React.ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];

    // جدول
    if (line.trim().startsWith("|") && i + 1 < lines.length && /^\|?[\s:|-]+\|/.test(lines[i + 1].trim())) {
      const header = line.split("|").map((c) => c.trim()).filter((c) => c !== "");
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        rows.push(lines[i].split("|").map((c) => c.trim()).filter((c) => c !== ""));
        i += 1;
      }
      blocks.push(
        <div key={key++} className="overflow-x-auto b-scroll b-card-sm !rounded-xl my-4">
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="border-b border-hairline-soft text-steel">
                {header.map((h, hi) => <th key={hi} className="text-right py-2.5 px-3 font-bold">{renderInline(h)}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, ri) => (
                <tr key={ri} className="border-b border-hairline-soft/50 last:border-0">
                  {r.map((c, ci) => <td key={ci} className="py-2.5 px-3">{renderInline(c)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    // کد بلوک
    if (line.trim().startsWith("```")) {
      const code: string[] = [];
      i += 1;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        code.push(lines[i]);
        i += 1;
      }
      i += 1;
      blocks.push(
        <pre key={key++} dir="ltr" className="b-card-sm !rounded-xl p-4 my-4 overflow-x-auto b-scroll font-mono text-[12px] leading-relaxed bg-ink-deep text-spring-soft">
          {code.join("\n")}
        </pre>
      );
      continue;
    }

    // هدینگ
    const heading = /^(#{1,4})\s+(.*)$/.exec(line);
    if (heading) {
      const level = heading[1].length;
      const text = heading[2];
      const sizes = ["text-xl font-bold mt-6 mb-3", "text-lg font-bold mt-5 mb-2.5", "text-[15px] font-bold mt-4 mb-2", "text-[13.5px] font-bold mt-3 mb-1.5"];
      blocks.push(
        React.createElement(level === 1 ? "h2" : level === 2 ? "h3" : "h4", { key: key++, className: sizes[level - 1] }, renderInline(text))
      );
      i += 1;
      continue;
    }

    // خط جدا
    if (/^---+$/.test(line.trim())) {
      blocks.push(<hr key={key++} className="my-5 border-hairline" />);
      i += 1;
      continue;
    }

    // نقل‌قول
    if (line.trim().startsWith(">")) {
      const quote: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith(">")) {
        quote.push(lines[i].trim().replace(/^>\s?/, ""));
        i += 1;
      }
      blocks.push(
        <blockquote key={key++} className="border-e-4 border-spring/40 bg-spring-tint/60 rounded-s-xl px-4 py-3 my-4 text-[13px] text-ink leading-relaxed">
          {renderInline(quote.join(" "))}
        </blockquote>
      );
      continue;
    }

    // لیست
    if (/^[-*]\s+/.test(line.trim()) || /^\d+\.\s+/.test(line.trim())) {
      const ordered = /^\d+\.\s+/.test(line.trim());
      const items: string[] = [];
      while (i < lines.length && (/^[-*]\s+/.test(lines[i].trim()) || /^\d+\.\s+/.test(lines[i].trim()))) {
        items.push(lines[i].trim().replace(/^[-*]\s+/, "").replace(/^\d+\.\s+/, ""));
        i += 1;
      }
      blocks.push(
        ordered ? (
          <ol key={key++} className="list-decimal pe-6 flex flex-col gap-1.5 my-3 text-[13.5px] leading-relaxed">
            {items.map((it, ii) => <li key={ii}>{renderInline(it)}</li>)}
          </ol>
        ) : (
          <ul key={key++} className="list-disc pe-6 flex flex-col gap-1.5 my-3 text-[13.5px] leading-relaxed">
            {items.map((it, ii) => <li key={ii}>{renderInline(it)}</li>)}
          </ul>
        )
      );
      continue;
    }

    // خط خالی
    if (line.trim() === "") {
      i += 1;
      continue;
    }

    // پاراگراف
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() !== "" && !/^(#{1,4})\s|^(---+)$|^>|^[-*]\s|^\d+\.\s|^\|/.test(lines[i].trim())) {
      para.push(lines[i]);
      i += 1;
    }
    blocks.push(
      <p key={key++} className="my-3 text-[13.5px] leading-[1.9]">
        {renderInline(para.join(" "))}
      </p>
    );
  }

  return <div className="markdown">{blocks}</div>;
}
