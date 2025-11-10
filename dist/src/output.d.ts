declare global {
    namespace NodeJS {
        interface Process {
            isCLI?: boolean;
        }
    }
}
export declare function watch(target: string): void;
export declare function move(target: string, dest: string): void;
export declare function copy(target: string, dest: string): void;
export declare function log(...text: any[]): void;
export declare function execute(...text: any[]): void;
export declare function info(...text: any[]): void;
export declare function write(...filename: any[]): void;
export declare function warn(...text: any[]): void;
export declare function critical(...text: any[]): void;
//# sourceMappingURL=output.d.ts.map