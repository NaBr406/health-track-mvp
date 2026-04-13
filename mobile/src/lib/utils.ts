function pad(value: number) {
  return `${value}`.padStart(2, "0");
}

function toDateKey(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function getTodayString() {
  return toDateKey(new Date());
}

export function getDateOffsetString(offset: number) {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return toDateKey(date);
}

export function getShiftedDateString(base: string, offset: number) {
  const date = new Date(`${base}T00:00:00`);
  date.setDate(date.getDate() + offset);
  return toDateKey(date);
}

export function formatShortDate(value: string) {
  return value.slice(5).replace("-", "/");
}

export function formatWeekday(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString("zh-CN", { weekday: "short" });
}

export function formatDisplayDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  return date.toLocaleDateString("zh-CN", {
    month: "numeric",
    day: "numeric",
    weekday: "short"
  });
}

export function formatDateTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "--";
  }

  return date.toLocaleString("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
}

export function formatTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "--:--";
  }

  return date.toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
}

export function safeNumber(value: string) {
  const trimmed = value.trim();

  if (trimmed === "") {
    return undefined;
  }

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function safeText(value: string) {
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

export function getInitials(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) {
    return "HT";
  }

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

export function average(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  const total = values.reduce((sum, value) => sum + value, 0);
  return total / values.length;
}

export function parseLeadingNumber(value?: string | null) {
  if (!value) {
    return undefined;
  }

  const matched = value.match(/-?\d+(\.\d+)?/);
  return matched ? Number(matched[0]) : undefined;
}
