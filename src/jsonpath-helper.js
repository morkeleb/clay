const jp = require("jsonpath");
const ui = require("./output");
const _ = require("lodash");

function recursive_parents(model, jsonpath, element, cleanModelClone) {
  if (!element) return;
  element["clay_json_key"] = element.value["clay_json_key"] =
    jsonpath[jsonpath.length - 1];

  // Use the pre-created clean clone to avoid circular references
  element.value.clay_model = cleanModelClone;

  var parent_path, parent, have_result;
  do {
    jsonpath.pop();
    parent_path = jp.stringify(jsonpath);
    parent = jp.nodes(model, parent_path);
    have_result =
      parent.length != 0 && !Array.isArray(parent[0].value) && parent[0].value;
  } while (!have_result);
  if (parent[0]) {
    if (jsonpath.length != 1)
      recursive_parents(model, parent[0].path, parent[0], cleanModelClone);
    have_result.json_path = parent_path;
    element.value.clay_parent = have_result;
    element.value.clay_key = jsonpath[jsonpath.length - 1];
  }
}

function select(model, jsonpath) {
  try {
    // Create a clean clone of the model before processing for clay_model access
    const cleanModelClone = _.cloneDeep(model);

    var result = jp.nodes(model, jsonpath);
    result.forEach((r) => recursive_parents(model, r.path, r, cleanModelClone));
  } catch (e) {
    ui.critical("Jsonpath not parseable ", jsonpath);

    return [];
  }
  if (result.length == 0) {
    ui.warn("No entires found for jsonpath ", jsonpath);
  }
  return result.map((f) => f.value);
}

module.exports = { select };
