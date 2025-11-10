import type { ClayModelEntry } from './types/clay-file';
interface ClayFileManager {
    models: ClayModelEntry[];
    getModelIndex: (modelPath: string, output?: string) => ClayModelEntry;
    save: () => void;
}
export declare function load(directory: string): ClayFileManager;
export declare function createClayFile(directory: string): void;
export {};
//# sourceMappingURL=clay_file.d.ts.map