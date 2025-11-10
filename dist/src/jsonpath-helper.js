"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.select = select;
const jsonpath_1 = __importDefault(require("jsonpath"));
const lodash_1 = __importDefault(require("lodash"));
const ui = __importStar(require("./output"));
function recursive_parents(model, jsonpath, element, cleanModelClone) {
    if (!element)
        return;
    element.value['clay_json_key'] = jsonpath[jsonpath.length - 1];
    element['clay_json_key'] = element.value['clay_json_key'];
    element.value.clay_model = cleanModelClone;
    let parent_path;
    let parent;
    let have_result;
    do {
        jsonpath.pop();
        parent_path = jsonpath_1.default.stringify(jsonpath);
        parent = jsonpath_1.default.nodes(model, parent_path);
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
function select(model, jsonpath) {
    try {
        const cleanModelClone = lodash_1.default.cloneDeep(model);
        const result = jsonpath_1.default.nodes(model, jsonpath);
        result.forEach((r) => recursive_parents(model, r.path, r, cleanModelClone));
        if (result.length === 0) {
            ui.warn('No entries found for jsonpath', jsonpath);
        }
        return result.map((f) => f.value);
    }
    catch {
        ui.critical('Jsonpath not parseable', jsonpath);
        return [];
    }
}
//# sourceMappingURL=jsonpath-helper.js.map