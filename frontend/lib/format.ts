// Integer maths only, so money never passes through a float (docs/DATABASE.md → Money).
export function formatTaka(poysha: number) {
  const sign = poysha < 0 ? "-" : "";
  const abs = Math.abs(poysha);
  return `${sign}৳${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

export function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
