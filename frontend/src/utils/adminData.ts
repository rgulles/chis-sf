export function eventDateForInput(value?: string | null): string {
  return value?.match(/^\d{4}-\d{2}-\d{2}/)?.[0] ?? '';
}

export function eventDateForSubmission(value?: string | null): string {
  const date = eventDateForInput(value);
  const time = value?.match(/[ T](\d{2}:\d{2}(?::\d{2})?)/)?.[1];
  return time ? `${date} ${time.length === 5 ? `${time}:00` : time}` : date;
}

export function replaceEventDate(value: string | undefined, date: string): string {
  if (!date) return '';
  const previous = eventDateForSubmission(value);
  return date + previous.slice(10);
}

export function storageImageUrl(path: string, backendBase = import.meta.env?.VITE_STORAGE_BASE_URL || ''): string {
  if (/^(https?:)?\/\//i.test(path)) return path;
  const base = backendBase.replace(/\/+$/, '').replace(/\/api$/, '');
  const relative = path.replace(/^\/+/, '').replace(/^storage\//, '');
  return `${base}/storage/${relative}`;
}
