/**
 * JSONPath helper module for querying and manipulating model data
 * Note: Uses `any` types because JSONPath queries return dynamically-typed data
 * that can be of any structure depending on the model being processed
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

import jp from 'jsonpath';
import _ from 'lodash';
import * as ui from './output';

interface JsonPathNode {
  path: string[];
  value: any;
  clay_json_key?: string;
}

function recursive_parents(
  model: any,
  jsonpath: string[],
  element: JsonPathNode | undefined,
  cleanModelClone: any
): void {
  if (!element) return;

  // Guard against non-object values that can't have properties added
  if (typeof element.value !== 'object' || element.value === null) {
    return;
  }

  // Don't add properties if this is an array - it might be iterated in templates
  if (Array.isArray(element.value)) {
    return;
  }

  element.value['clay_json_key'] = jsonpath[jsonpath.length - 1];
  element['clay_json_key'] = element.value['clay_json_key'];

  // Use the pre-created clean clone to avoid circular references
  element.value.clay_model = cleanModelClone;

  let parent_path: string = '';
  let parent: JsonPathNode[] = [];
  let have_result: any;

  // Create a copy of jsonpath to avoid mutating the original array
  const pathCopy = [...jsonpath];

  do {
    pathCopy.pop();
    // Safety check: stop if we've exhausted the path
    if (pathCopy.length === 0) break;

    parent_path = jp.stringify(pathCopy);
    parent = jp.nodes(model, parent_path) as JsonPathNode[];
    have_result =
      parent.length !== 0 && !Array.isArray(parent[0].value) && parent[0].value;
  } while (!have_result && pathCopy.length > 0);

  if (parent[0]) {
    if (pathCopy.length !== 1) {
      recursive_parents(model, parent[0].path, parent[0], cleanModelClone);
    }
    have_result.json_path = parent_path;
    element.value.clay_parent = have_result;
    element.value.clay_key = pathCopy[pathCopy.length - 1];
  }
}

export function select(model: any, jsonpath: string): any[] {
  try {
    // Clone the model FIRST to avoid polluting the original
    const modelCopy = _.cloneDeep(model);

    // Create a clean clone for clay_model references
    const cleanModelClone = _.cloneDeep(model);

    const result = jp.nodes(modelCopy, jsonpath) as JsonPathNode[];
    result.forEach((r) =>
      recursive_parents(modelCopy, r.path, r, cleanModelClone)
    );

    if (result.length === 0) {
      ui.warn('No entries found for jsonpath', jsonpath);
    }

    return result.map((f) => f.value);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    ui.critical('Jsonpath not parseable', jsonpath, 'Error:', errorMsg);
    return [];
  }
}
