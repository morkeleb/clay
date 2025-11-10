import Handlebars from 'handlebars';
declare const handlebars: typeof Handlebars & {
    __switch_stack__: Array<{
        switch_match: boolean;
        switch_value: any;
    }>;
    load_partials: (templates: string[], directory: string) => void;
};
export default handlebars;
//# sourceMappingURL=template-engine.d.ts.map