/**
 * Verify vendored QR encoder (src/lib/qr.ts) against Python's `qrcode` reference library.
 * Compares full module matrices for multiple inputs/ECC levels via ts-node-free approach:
 * we compile with Bun and dump matrices as JSON, then diff against Python output.
 */
import { qrMatrix } from "../src/lib/qr";

const cases: Array<{ text: string; ecl: "LOW" | "MEDIUM" | "QUARTILE" | "HIGH" }> = JSON.parse(
  process.argv[2] ?? "[]",
);

const out = cases.map(({ text, ecl }) => {
  const m = qrMatrix(text, ecl);
  return { text, ecl, size: m.length, matrix: m.map((row) => row.map((b) => (b ? 1 : 0)).join("")) };
});
console.log(JSON.stringify(out));
