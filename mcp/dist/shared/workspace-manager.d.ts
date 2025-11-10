export interface WorkspaceContext {
    workingDirectory: string;
    hasClayFile: boolean;
    clayFilePath: string;
}
/**
 * Get the workspace context for a given directory
 */
export declare function getWorkspaceContext(workingDir?: string): WorkspaceContext;
/**
 * Validate that a .clay file exists in the working directory
 */
export declare function requireClayFile(workingDir?: string): WorkspaceContext;
/**
 * Resolve a path relative to the working directory
 */
export declare function resolvePath(workingDir: string, relativePath: string): string;
/**
 * Validate that a path exists
 */
export declare function validatePathExists(filePath: string, description: string): void;
/**
 * Ensure a directory exists
 */
export declare function ensureDirectory(dirPath: string): void;
//# sourceMappingURL=workspace-manager.d.ts.map