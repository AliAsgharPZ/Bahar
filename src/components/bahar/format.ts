/**
 * Bahar formatting helpers.
 *
 * Display rules, enforced in one place so callers never format by hand:
 * Persian digits, Jalali dates, currency unit word after the number.
 * Grouping uses the Persian thousands separator.
 */

import { faDigits, todayJalali } from "@/lib/persian";

export function faNumber(value: number | string): string {
  return faDigits(String(value));
}

/** Grouped digits, e.g. 12840000 -> ۱۲٬۸۴۰٬۰۰۰. */
export function faGrouped(value: number): string {
  const grouped = new Intl.NumberFormat("en-US").format(value);
  return faDigits(grouped.replace(/,/g, "٬"));
}

export function faCurrency(value: number): string {
  return `${faGrouped(value)} تومان`;
}

export function faPercent(value: number): string {
  return `${faDigits(String(value))}٪`;
}

export function jalaliToday(): string {
  return todayJalali();
}
