/** Clamp a value between min and max (inclusive). */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(min, value), max);
}

/** Extract a human-friendly message from unknown errors. */
export function errorMessage(err: unknown): string {
  if (err instanceof Error) {
    return err.message || '';
  }
  if (typeof err === 'string') {
    return err;
  }
  try {
    return JSON.stringify(err);
  } catch {
    return '';
  }
}

