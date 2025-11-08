/**
 * Type definitions for Clay models
 */

/**
 * Mixin definition in a Clay model
 */
export interface MixinDefinition {
  name: string;
  function: string | Function;
}

/**
 * Base model structure that supports mixins and includes
 */
export interface ModelWithMixins {
  mixin?: string[];
  include?: string;
  [key: string]: any;
}

/**
 * Clay model root structure
 */
export interface ClayModel {
  name: string;
  generators: string[];
  mixins?: MixinDefinition[];
  model: {
    [key: string]: any;
  };
}

/**
 * Loaded model with resolved mixins and includes
 */
export interface LoadedModel extends ClayModel {
  path: string;
}
