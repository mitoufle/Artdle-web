/**
 * Central error-reporting seam. Call sites use `reportError(err, context)`.
 * Tests and v2.0+ telemetry backends swap the default `console.error` sink
 * via `setErrorReporter(fn)`; `resetErrorReporter()` restores the default.
 *
 * The default is captured in `_defaultOnError` so reset doesn't depend on
 * the caller re-typing the implementation.
 */
type ErrorReporter = (err: Error, context: string) => void;

const _defaultOnError: ErrorReporter = (err, context) => {
  console.error(`[${context}]`, err);
};

let _onError: ErrorReporter = _defaultOnError;

export function reportError(err: Error, context: string): void {
  _onError(err, context);
}

export function setErrorReporter(fn: ErrorReporter): void {
  _onError = fn;
}

export function resetErrorReporter(): void {
  _onError = _defaultOnError;
}
