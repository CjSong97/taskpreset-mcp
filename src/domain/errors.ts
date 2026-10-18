export type WaypointErrorCode =
  | "validation"
  | "not_found"
  | "conflict"
  | "invalid_transition"
  | "ineligible"
  | "config"
  | "storage"
  | "busy";

/** Expected, user-facing failure. Messages must not include item titles or descriptions. */
export class WaypointError extends Error {
  readonly code: WaypointErrorCode;
  readonly details: Record<string, unknown> | undefined;

  constructor(code: WaypointErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = "WaypointError";
    this.code = code;
    this.details = details;
  }
}

export function isWaypointError(error: unknown): error is WaypointError {
  return error instanceof WaypointError;
}
