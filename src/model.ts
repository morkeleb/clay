import path from 'path';
import { requireNew } from './require-helper';
import type { ClayModel, MixinDefinition } from './types/model';

/**
 * Execute mixins on the model
 * Mixins are functions that modify parts of the model
 */
function executeMixins(model: ClayModel): void {
  if (!model.mixins || model.mixins.length === 0) return;

  // Build a map of mixin functions
  const mixins: Record<string, Function> = model.mixins.reduce(
    (map, obj: MixinDefinition) => {
      if (typeof obj.function === 'string') {
        // eslint-disable-next-line no-eval
        map[obj.name] = eval(obj.function);
      } else {
        map[obj.name] = obj.function;
      }
      return map;
    },
    {} as Record<string, Function>
  );

  // Recursively check and apply mixins
  const check = (m: any): void => {
    if (m === null || m === undefined) return;

    if (Object.prototype.hasOwnProperty.call(m, 'mixin')) {
      const mixinKeys = m.mixin as string[];
      mixinKeys.forEach((mixin_key) => {
        if (mixins[mixin_key]) {
          mixins[mixin_key](m);
        }
      });
      delete m.mixin;
    }

    if (Array.isArray(m)) {
      for (let index = 0; index < m.length; index++) {
        const element = m[index];
        if (typeof element === 'object' && element !== null) {
          check(element);
        }
      }
      return;
    }

    for (const property in m) {
      if (Object.prototype.hasOwnProperty.call(m, property)) {
        const e = m[property];
        if (typeof e === 'object' && e !== null) {
          check(e);
        }
      }
    }
  };

  // Apply mixins to all properties in the model
  for (const modelproperty in model.model) {
    if (Object.prototype.hasOwnProperty.call(model.model, modelproperty)) {
      const element = model.model[modelproperty];
      check(element);
    }
  }
}

/**
 * Execute includes in the model
 * Includes allow referencing external JSON files
 */
function executeIncludes(model: any, modelPath: string): void {
  const check = (m: any): void => {
    if (m === null || m === undefined) return;

    if (Object.prototype.hasOwnProperty.call(m, 'include')) {
      const includePath = path.resolve(
        path.join(path.dirname(modelPath), m.include)
      );
      const includeData = require(includePath);

      for (const key in includeData) {
        if (Object.prototype.hasOwnProperty.call(includeData, key)) {
          m[key] = includeData[key];
        }
      }
      delete m.include;
    }

    if (Array.isArray(m)) {
      for (let index = 0; index < m.length; index++) {
        const element = m[index];
        if (typeof element === 'object' && element !== null) {
          check(element);
        }
      }
    }

    for (const property in m) {
      if (Object.prototype.hasOwnProperty.call(m, property)) {
        const e = m[property];
        if (typeof e === 'object' && e !== null) {
          check(e);
        }
      }
    }
  };

  // Execute includes on all top-level properties
  for (const modelproperty in model) {
    if (Object.prototype.hasOwnProperty.call(model, modelproperty)) {
      const element = model[modelproperty];
      check(element);
    }
  }
}

/**
 * Load a Clay model from a file path
 * Processes includes and mixins
 *
 * @param modelPath - Path to the model JSON file
 * @returns The loaded and processed model
 */
export function load(modelPath: string): ClayModel {
  const resolvedPath = path.resolve(modelPath);
  const model = requireNew(resolvedPath) as ClayModel;

  executeIncludes(model, modelPath);
  executeMixins(model);

  return model;
}
