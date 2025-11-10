export interface CommandResult {
    success: boolean;
    output: string;
    error?: string;
}
/**
 * Execute a Clay CLI command in the specified working directory
 */
export declare function executeClayCommand(command: string, args: string[], workingDirectory: string): CommandResult;
/**
 * Check if Clay CLI is available
 */
export declare function isClayAvailable(): boolean;
/**
 * Get Clay CLI version
 */
export declare function getClayVersion(): string | null;
/**
 * Parse Clay generate output to extract statistics
 */
export declare function parseGenerateOutput(output: string): {
    filesGenerated: number;
    filesUpdated: number;
    filesUnchanged: number;
    filesCopied: number;
    filesMoved: number;
};
/**
 * Read and parse .clay file
 */
export declare function readClayFile(clayFilePath: string): {
    models: Array<{
        path: string;
        output: string;
        generated_files: Record<string, unknown>;
        last_generated?: string;
    }>;
};
//# sourceMappingURL=clay-wrapper.d.ts.map