export type ApplicationErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "VALIDATION_ERROR";

export class ApplicationError extends Error {
  constructor(
    public readonly code: ApplicationErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ApplicationError";
  }
}

export function getSafeErrorMessage(error: unknown) {
  return error instanceof ApplicationError ? error.message : "Something went wrong. Please try again.";
}
