export type TaskPresetErrorCode =
  | "validation"
  | "not_found"
  | "conflict"
  | "invalid_transition"
  | "ineligible"
  | "config"
  | "storage"
  | "busy";

/** Expected, user-facing failure. Messages must not include item titles or descriptions. */
export class TaskPresetError extends Error {
  readonly code: TaskPresetErrorCode;
  readonly details: Record<string, unknown> | undefined;

  constructor(code: TaskPresetErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = "TaskPresetError";
    this.code = code;
    this.details = details;
  }
}

export function isTaskPresetError(error: unknown): error is TaskPresetError {
  return error instanceof TaskPresetError;
}
