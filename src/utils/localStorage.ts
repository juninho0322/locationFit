export type StorageError = "read-error" | "write-error";
export type StorageStatus = "saved" | "saving" | StorageError;

export function readLocalValue<T>(
  storage: Pick<Storage, "getItem">,
  key: string,
  fallback: T,
  validate?: (value: unknown) => value is T,
): { value: T; error: StorageError | null } {
  try {
    const raw = storage.getItem(key);
    if (raw === null) return { value: fallback, error: null };
    const value: unknown = JSON.parse(raw);
    if (
      value === null ||
      typeof value !== typeof fallback ||
      Array.isArray(value) !== Array.isArray(fallback) ||
      (validate && !validate(value))
    ) {
      throw new Error("Unexpected saved data format");
    }
    return { value: value as T, error: null };
  } catch {
    return { value: fallback, error: "read-error" };
  }
}

export function writeLocalValue<T>(
  storage: Pick<Storage, "setItem">,
  key: string,
  value: T,
): StorageError | null {
  try {
    storage.setItem(key, JSON.stringify(value));
    return null;
  } catch {
    return "write-error";
  }
}
