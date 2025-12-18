import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format a number in compact notation (e.g., 1.2K, 24.5M)
 * Max 3 significant digits before suffix
 */
export function formatCompactNumber(value: number | string | undefined | null): string {
  if (value === undefined || value === null || value === "" || value === "—") return "0";
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "0";
  
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
    minimumFractionDigits: 0,
  }).format(num);
}

/**
 * Format currency in compact notation (e.g., $1.2K, $24.5M)
 * Max 3 significant digits before suffix
 */
export function formatCompactCurrency(value: number | string | undefined | null): string {
  if (value === undefined || value === null || value === "" || value === "—") return "$0";
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "$0";
  
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
    minimumFractionDigits: 0,
  }).format(num);
}
