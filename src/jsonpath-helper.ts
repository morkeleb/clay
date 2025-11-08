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

  element.value['clay_json_key'] = jsonpath[jsonpath.length - 1];
  element['clay_json_key'] = element.value['clay_json_key'];

  // Use the pre-created clean clone to avoid circular references
  element.value.clay_model = cleanModelClone;

  let parent_path: string;
  let parent: JsonPathNode[];
  let have_result: any;

  do {
    jsonpath.pop();
    parent_path = jp.stringify(jsonpath);
    parent = jp.nodes(model, parent_path) as JsonPathNode[];
    have_result =
      parent.length !== 0 && !Array.isArray(parent[0].value) && parent[0].value;
  } while (!have_result);

  if (parent[0]) {
    if (jsonpath.length !== 1) {
      recursive_parents(model, parent[0].path, parent[0], cleanModelClone);
    }
    have_result.json_path = parent_path;
    element.value.clay_parent = have_result;
    element.value.clay_key = jsonpath[jsonpath.length - 1];
  }
}

export function select(model: any, jsonpath: string): any[] {
  try {
    // Create a clean clone of the model before processing for clay_model access
    const cleanModelClone = _.cloneDeep(model);

    const result = jp.nodes(model, jsonpath) as JsonPathNode[];
    result.forEach((r) => recursive_parents(model, r.path, r, cleanModelClone));

    if (result.length === 0) {
      ui.warn('No entries found for jsonpath', jsonpath);
    }

    return result.map((f) => f.value);
  } catch (e) {
    ui.critical('Jsonpath not parseable', jsonpath);
    return [];
  }
}
