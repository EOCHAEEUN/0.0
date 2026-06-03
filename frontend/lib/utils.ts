export function formatDday(deadline: string): string {
  const diff = Math.ceil((new Date(deadline).getTime() - Date.now()) / 86400000);
  if (diff === 0) return "D-day";
  return diff > 0 ? `D-${diff}` : `D+${Math.abs(diff)}`;
}

export function formatAmount(manwon: number): string {
  if (manwon >= 10000) {
    const uk = Math.floor(manwon / 10000);
    const rem = manwon % 10000;
    return rem > 0 ? `${uk}억 ${rem.toLocaleString()}만원` : `${uk}억원`;
  }
  return `${manwon.toLocaleString()}만원`;
}

export function urgencyLevel(dday: number): "urgent" | "warn" | "normal" {
  if (dday <= 42) return "urgent";
  if (dday <= 90) return "warn";
  return "normal";
}
