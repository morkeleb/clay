/**
 * Validation utilities for MCP tool inputs
 */
import { z } from 'zod';

/**
 * Validate input against a Zod schema
 */
export function validateInput<T>(
  schema: z.ZodType<T>,
  input: unknown
): { success: true; data: T } | { success: false; error: string } {
  const result = schema.safeParse(input);

  if (result.success) {
    return { success: true, data: result.data };
  }

  const errorMessages = result.error.errors
    .map((err) => {
      const path = err.path.join('.');
      return `${path}: ${err.message}`;
    })
    .join('; ');

  return {
    success: false,
    error: `Validation failed: ${errorMessages}`,
  };
}

/**
 * Create a standardized error response
 */
export function createErrorResponse(
  message: string,
  details?: unknown
): {
  success: false;
  message: string;
  details?: unknown;
} {
  const response: { success: false; message: string; details?: unknown } = {
    success: false,
    message,
  };

  if (details !== undefined) {
    response.details = details;
  }

  return response;
}

/**
 * Create a standardized success response
 */
export function createSuccessResponse<T extends Record<string, unknown>>(
  message: string,
  data?: T
): {
  success: true;
  message: string;
} & T {
  return {
    success: true,
    message,
    ...data,
  } as {
    success: true;
    message: string;
  } & T;
}

/**
 * Validate JSONPath expression
 */
export function validateJSONPath(jsonPath: string): {
  valid: boolean;
  error?: string;
} {
  try {
    // Basic validation - check for common JSONPath syntax
    if (!jsonPath.startsWith('$')) {
      return { valid: false, error: 'JSONPath must start with $' };
    }

    // More thorough validation could use a JSONPath parser
    // For now, basic checks
    if (jsonPath.includes('..') && jsonPath.includes('[')) {
      // Valid recursive descent with filter
    }

    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Invalid JSONPath',
    };
  }
}

/**
 * Sanitize file paths to prevent directory traversal
 */
export function sanitizePath(inputPath: string): string {
  // Remove any ../ or .\ sequences
  const normalized = inputPath.replace(/\.\.[\/\\]/g, '');
  return normalized;
}
