/**
 * Validate input against a Zod schema
 */
export function validateInput(schema, input) {
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
export function createErrorResponse(message, details) {
    const response = {
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
export function createSuccessResponse(message, data) {
    return {
        success: true,
        message,
        ...data,
    };
}
/**
 * Validate JSONPath expression
 */
export function validateJSONPath(jsonPath) {
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
    }
    catch (error) {
        return {
            valid: false,
            error: error instanceof Error ? error.message : 'Invalid JSONPath',
        };
    }
}
/**
 * Sanitize file paths to prevent directory traversal
 */
export function sanitizePath(inputPath) {
    // Remove any ../ or .\ sequences
    const normalized = inputPath.replace(/\.\.[\/\\]/g, '');
    return normalized;
}
//# sourceMappingURL=validation.js.map