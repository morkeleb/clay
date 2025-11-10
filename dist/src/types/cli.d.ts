export interface GenerateOptions {
    modelPath?: string;
    outputPath?: string;
    verbose?: boolean;
}
export interface CleanOptions {
    modelPath?: string;
    outputPath?: string;
    verbose?: boolean;
}
export interface WatchOptions {
    modelPath?: string;
    outputPath?: string;
    verbose?: boolean;
}
export interface TestPathOptions {
    modelPath: string;
    jsonPath: string;
    verbose?: boolean;
}
export interface InitOptions {
    type?: 'generator' | 'model';
    name?: string;
    verbose?: boolean;
}
export interface GlobalOptions {
    verbose?: boolean;
}
//# sourceMappingURL=cli.d.ts.map