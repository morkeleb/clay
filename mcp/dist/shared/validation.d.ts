/**
 * Validation utilities for MCP tool inputs
 */
import { z } from 'zod';
/**
 * Validate input against a Zod schema
 */
export declare function validateInput<T>(schema: z.ZodType<T>, input: unknown): {
    success: true;
    data: T;
} | {
    success: false;
    error: string;
};
/**
 * Create a standardized error response
 */
export declare function createErrorResponse(message: string, details?: unknown): {
    success: false;
    message: string;
    details?: unknown;
};
/**
 * Create a standardized success response
 */
export declare function createSuccessResponse<T extends Record<string, unknown>>(message: string, data?: T): {
    success: true;
    message: string;
} & T;
/**
 * Validate JSONPath expression
 */
export declare function validateJSONPath(jsonPath: string): {
    valid: boolean;
    error?: string;
};
/**
 * Sanitize file paths to prevent directory traversal
 */
export declare function sanitizePath(inputPath: string): string;
//# sourceMappingURL=validation.d.ts.map