// Formatting helpers for numbers, percentages, and dates
export function formatUSD(num) {
  if (typeof num !== 'number') return '-';
  return '$' + num.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export function formatPct(num, digits = 2) {
  if (typeof num !== 'number') return '-';
  return num.toFixed(digits) + '%';
}

export function formatNumber(num, digits = 2) {
  if (typeof num !== 'number') return '-';
  return num.toLocaleString(undefined, { maximumFractionDigits: digits });
}
