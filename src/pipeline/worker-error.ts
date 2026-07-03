/**
 * Serialization for errors that cross the worker-thread boundary.
 *
 * When a render throws inside a worker, only structured-clone-safe values can
 * be posted back to the main thread — a live Error object loses its stack and
 * name in transit. These pure functions capture the full error (message, name,
 * stack) plus the render context (which model/template/engine was running) so
 * the main thread can reconstruct an actionable Error.
 *
 * Kept free of worker_threads imports so they can be unit-tested directly.
 */

/** What the worker was rendering when it threw, for user-facing context. */
export interface RenderErrorContext {
  modelPath?: string;
  templatePath?: string;
  engine?: string;
}

/** Structured-clone-safe representation of a worker-side error. */
export interface SerializedWorkerError {
  message: string;
  name: string;
  stack?: string;
  context?: RenderErrorContext;
}

/**
 * Capture a thrown value (Error or otherwise) into a plain, cloneable object.
 * Non-Error values (strings, objects) are coerced to a message string.
 */
export function serializeWorkerError(
  e: unknown,
  context?: RenderErrorContext
): SerializedWorkerError {
  const hasContext =
    !!context &&
    (context.modelPath !== undefined ||
      context.templatePath !== undefined ||
      context.engine !== undefined);

  if (e instanceof Error) {
    return {
      message: e.message,
      name: e.name || 'Error',
      stack: e.stack,
      ...(hasContext ? { context } : {}),
    };
  }

  return {
    message: typeof e === 'string' ? e : safeStringify(e),
    name: 'Error',
    ...(hasContext ? { context } : {}),
  };
}

/**
 * Rebuild an Error on the main thread from a serialized payload. The
 * reconstructed error carries the original name and, when render context is
 * present, prefixes the message with which model/template/engine failed. The
 * worker-side stack is preserved (appended if the message was augmented so the
 * original frames stay visible).
 */
export function deserializeWorkerError(
  payload: SerializedWorkerError
): Error {
  const contextLine = formatContext(payload.context);
  const message = contextLine
    ? `${contextLine}\n${payload.message}`
    : payload.message;

  const error = new Error(message);
  error.name = payload.name || 'Error';

  if (payload.stack) {
    // Keep the worker-side frames visible. When we augmented the message with
    // render context, prepend the augmented header so the stack reads coherently.
    error.stack = contextLine
      ? `${error.name}: ${message}\n${payload.stack}`
      : payload.stack;
  }

  return error;
}

function formatContext(context?: RenderErrorContext): string {
  if (!context) return '';
  const parts: string[] = [];
  if (context.templatePath) parts.push(`template ${context.templatePath}`);
  if (context.modelPath) parts.push(`model ${context.modelPath}`);
  if (context.engine) parts.push(`engine ${context.engine}`);
  if (parts.length === 0) return '';
  return `Render failed while processing ${parts.join(', ')}:`;
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
}
