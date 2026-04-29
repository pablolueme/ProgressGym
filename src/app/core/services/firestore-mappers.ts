import { Timestamp } from 'firebase/firestore';

export const toDate = (value: unknown): Date => {
  if (value instanceof Date) {
    return value;
  }
  if (value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') {
    const converted = value.toDate();
    if (converted instanceof Date && Number.isFinite(converted.getTime())) {
      return converted;
    }
  }
  if (value instanceof Timestamp) {
    return value.toDate();
  }
  if (value && typeof value === 'object' && 'seconds' in value) {
    const seconds = Number((value as { seconds?: unknown }).seconds);
    const nanoseconds = Number((value as { nanoseconds?: unknown }).nanoseconds ?? 0);
    if (Number.isFinite(seconds) && Number.isFinite(nanoseconds)) {
      const millis = seconds * 1000 + Math.floor(nanoseconds / 1_000_000);
      const date = new Date(millis);
      if (Number.isFinite(date.getTime())) {
        return date;
      }
    }
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value);
    if (Number.isFinite(date.getTime())) {
      return date;
    }
  }
  return new Date(0);
};

export const sanitizeArray = <T>(value: unknown): T[] => {
  if (Array.isArray(value)) {
    return value as T[];
  }
  return [];
};
