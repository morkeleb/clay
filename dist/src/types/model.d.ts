export interface MixinDefinition {
    name: string;
    function: string | ((...args: any[]) => any);
}
export interface ModelWithMixins {
    mixin?: string[];
    include?: string;
    [key: string]: any;
}
export interface ClayModel {
    name: string;
    generators: string[];
    mixins?: MixinDefinition[];
    model: {
        [key: string]: any;
    };
}
export interface LoadedModel extends ClayModel {
    path: string;
}
//# sourceMappingURL=model.d.ts.map