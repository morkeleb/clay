export interface GeneratorStepGenerate {
    generate: string;
    select: string;
    target?: string;
    touch?: boolean;
}
export interface GeneratorStepCopy {
    copy: string;
    select?: string;
    target?: string;
}
export interface GeneratorStepCommand {
    runCommand: string;
    select?: string;
    npxCommand?: boolean;
    verbose?: boolean;
}
export type GeneratorStep = GeneratorStepGenerate | GeneratorStepCopy | GeneratorStepCommand;
export interface Generator {
    partials: string[];
    formatters: string[];
    steps: GeneratorStep[];
}
export interface DecoratedGenerator extends Generator {
    generate: (model: any, outputDir: string) => Promise<void>;
    clean: (model: any, outputDir: string) => void;
}
export declare function isGenerateStep(step: GeneratorStep): step is GeneratorStepGenerate;
export declare function isCopyStep(step: GeneratorStep): step is GeneratorStepCopy;
export declare function isCommandStep(step: GeneratorStep): step is GeneratorStepCommand;
//# sourceMappingURL=generator.d.ts.map