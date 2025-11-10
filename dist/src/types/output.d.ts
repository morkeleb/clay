export interface WriteFileOptions {
    touch?: boolean;
    formatter?: (content: string, filePath: string) => string | Promise<string>;
}
export interface FileChangeResult {
    changed: boolean;
    oldHash?: string;
    newHash: string;
}
export interface OutputManager {
    writeFile: (filePath: string, content: string, options?: WriteFileOptions) => Promise<void>;
    deleteFile: (filePath: string) => Promise<void>;
    fileExists: (filePath: string) => boolean;
    calculateHash: (content: string) => string;
    hasFileChanged: (filePath: string, content: string, oldHash?: string) => FileChangeResult;
}
//# sourceMappingURL=output.d.ts.map