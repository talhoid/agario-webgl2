// util/nonnull.ts
export function nonnull<T>(value: T | null | undefined, message?: string): T {
    if (value === null || value === undefined) {
        throw new Error(message || "Value must not be null/undefined");
    }
    return value;
}