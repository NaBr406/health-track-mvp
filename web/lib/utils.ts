export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function getTodayString() {
  return new Date().toISOString().slice(0, 10);
}

export function getDateOffsetString(offset: number) {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return date.toISOString().slice(0, 10);
}

export function formatDateLabel(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit"
  }).format(new Date(value));
}

export function safeNumber(value: string) {
  return value === "" ? undefined : Number(value);
}

