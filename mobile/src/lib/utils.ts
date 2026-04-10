export function getTodayString() {
  return new Date().toISOString().slice(0, 10);
}

export function getDateOffsetString(offset: number) {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return date.toISOString().slice(0, 10);
}

export function formatShortDate(value: string) {
  return value.slice(5).replace("-", "/");
}

export function safeNumber(value: string) {
  return value.trim() === "" ? undefined : Number(value);
}
