/**
 * Type declarations for external modules without official type definitions
 */

declare module 'handlebars-group-by' {
  import Handlebars from 'handlebars';
  interface GroupBy {
    register: (handlebars: typeof Handlebars) => void;
  }
  const groupBy: GroupBy;
  export default groupBy;
}

declare module 'lobars' {
  import Handlebars from 'handlebars';
  const lobars: Handlebars.HelperDeclareSpec;
  export default lobars;
}

declare module 'lodash-inflection' {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lodashInflection: Record<string, (...args: any[]) => any>;
  export default lodashInflection;
}
