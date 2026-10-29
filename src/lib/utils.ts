import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

import { faNumber } from "./persian";
export { faNumber };
export function faPercent(n: number | string): string {
  return faNumber(n) + "٪";
}
