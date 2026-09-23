// Integer maths only, so money never passes through a float (docs/DATABASE.md → Money).
export function formatTaka(poysha: number) {
  const sign = poysha < 0 ? "-" : "";
  const abs = Math.abs(poysha);
  return `${sign}৳${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}
