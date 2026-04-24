import { Timestamp } from 'firebase/firestore';

export const toDate = (value: unknown): Date => {
  if (value instanceof Date) {
    return value;
  }
  if (value instanceof Timestamp) {
    return value.toDate();
  }
  return new Date(0);
};

export const sanitizeArray = <T>(value: unknown): T[] => {
  if (Array.isArray(value)) {
    return value as T[];
  }
  return [];
};
