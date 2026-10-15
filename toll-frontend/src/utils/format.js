export const zmw = (n) => `ZMW ${(n / 100).toFixed(2)}`;

export const parseUtc = (s) =>
  new Date(typeof s === 'string' && !s.endsWith('Z') ? s + 'Z' : s);

export const fmtDateTime = (s) =>
  parseUtc(s)
    .toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
    .replace(/ /g, '\u00A0'); // non-breaking spaces — the date never folds mid-token

export const timeAgo = (s) => {
  const sec = Math.max(1, (Date.now() - parseUtc(s).getTime()) / 1000);
  if (sec < 60) return 'just now';
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  return `${Math.floor(sec / 86400)}d ago`;
};

export const initials = (name = '') =>
  name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() || '').join('') || '?';

export const PROVIDERS = {
  airtel_money: 'Airtel Money',
  mtn_momo: 'MTN MoMo',
  zamtel_kwacha: 'Zamtel Kwacha',
};

export const CLASSES = {
  motorcycle: 'Motorcycle',
  light: 'Light vehicle',
  medium: 'Medium',
  heavy: 'Heavy',
};

export const PAY_LABELS = {
  account_balance: 'Balance',
  mobile_money: 'MoMo',
  prepaid_pass: 'Toll pass',
};

export function downloadCsv(filename, rows) {
  const csv = rows
    .map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}