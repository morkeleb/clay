import type { ClayFileManager } from './types/clay-file';
interface GeneratorRegistry {
    generators: {
        [key: string]: {
            name: string;
            description: string;
            repository: string;
            tags: string[];
        };
    };
}
interface GeneratorUsage {
    modelIndex: number;
    modelPath: string;
    generator: string | object;
}
interface GeneratorInfo {
    name: string;
    usedInModels: GeneratorUsage[];
}
export declare function loadGeneratorRegistry(): Promise<GeneratorRegistry>;
export declare function findGeneratorInRegistry(generatorName: string): Promise<GeneratorRegistry['generators'][string] | null>;
export declare function listAvailableGenerators(): Promise<void>;
export declare function clearRegistryCache(): void;
export declare function getAllGenerators(clayFile: ClayFileManager): GeneratorInfo[];
export declare function listGenerators(clayFile: ClayFileManager): void;
export declare function generatorExistsLocally(generatorRef: string): boolean;
export declare function addGenerator(generatorRef: string, clayFile: ClayFileManager): Promise<void>;
export declare function deleteGenerator(generatorName: string | undefined, clayFile: ClayFileManager): Promise<void>;
export {};
//# sourceMappingURL=generator-manager.d.ts.map