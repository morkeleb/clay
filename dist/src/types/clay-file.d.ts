export interface ClayFileEntry {
    md5: string;
    date: string;
}
export interface ClayModelEntry {
    path: string;
    output?: string;
    generated_files: {
        [filePath: string]: ClayFileEntry;
    };
    last_generated?: string;
    setFileCheckSum: (filePath: string, md5: string) => void;
    getFileCheckSum: (filePath: string) => string | null;
    delFileCheckSum: (filePath: string) => void;
    load: () => any;
}
export interface ClayFile {
    models: ClayModelEntry[];
}
export type ModelIndex = ClayModelEntry;
export interface ClayFileManager {
    models: ClayModelEntry[];
    getModelIndex: (modelPath: string, output?: string) => ModelIndex;
    save: () => void;
}
//# sourceMappingURL=clay-file.d.ts.map