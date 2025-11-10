import type { ClayModel } from './model';
export interface ClayTemplateContext {
    clay_model: ClayModel;
    clay_parent?: any;
    clay_key?: string;
    clay_json_key?: string;
    json_path?: string;
    [key: string]: any;
}
export interface TemplateEngineConfig {
    partials?: string[];
    helpers?: {
        [name: string]: (...args: any[]) => any;
    };
}
export type HandlebarsHelper = (...args: any[]) => any;
export type FormatterFunction = (content: string, filePath: string) => string | Promise<string>;
export interface RegisteredFormatter {
    name: string;
    format: FormatterFunction;
}
//# sourceMappingURL=template.d.ts.map