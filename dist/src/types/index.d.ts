export * from './generator';
export * from './model';
export * from './clay-file';
export * from './template';
export * from './cli';
export * from './output';
export type DeepPartial<T> = {
    [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};
export type Parameters<T extends (...args: any) => any> = T extends (...args: infer P) => any ? P : never;
export type ReturnType<T extends (...args: any) => any> = T extends (...args: any) => infer R ? R : any;
//# sourceMappingURL=index.d.ts.map