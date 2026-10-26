import { useEffect, useState } from "react";
import {
  readLocalValue,
  writeLocalValue,
  type StorageError,
  type StorageStatus,
} from "../utils/localStorage";

export function useLocalStorage<T>(
  key: string,
  initialValue: T,
  validate?: (value: unknown) => value is T,
) {
  const [initial] = useState(() => {
    if (typeof window === "undefined") {
      return { value: initialValue, error: null };
    }
    try {
      return readLocalValue(window.localStorage, key, initialValue, validate);
    } catch {
      return { value: initialValue, error: "read-error" as const };
    }
  });
  const [value, setValue] = useState<T>(initial.value);
  const [savedValue, setSavedValue] = useState<T>(initial.value);
  const [error, setError] = useState<StorageError | null>(initial.error);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    // Never replace unreadable saved data with the fallback value.
    if (initial.error) return;
    try {
      const failure = writeLocalValue(window.localStorage, key, value);
      setError(failure);
      if (!failure) setSavedValue(value);
    } catch {
      setError("write-error");
    }
  }, [key, value, attempt, initial.error]);

  const status: StorageStatus =
    error ?? (value === savedValue ? "saved" : "saving");
  return [
    value,
    setValue,
    { status, retry: () => setAttempt((count) => count + 1) },
  ] as const;
}
