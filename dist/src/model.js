"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.load = load;
const path_1 = __importDefault(require("path"));
const require_helper_1 = require("./require-helper");
function executeMixins(model) {
    if (!model.mixins || model.mixins.length === 0)
        return;
    const mixins = model.mixins.reduce((map, obj) => {
        if (typeof obj.function === 'string') {
            map[obj.name] = eval(obj.function);
        }
        else {
            map[obj.name] = obj.function;
        }
        return map;
    }, {});
    const check = (m) => {
        if (m === null || m === undefined)
            return;
        if (Object.prototype.hasOwnProperty.call(m, 'mixin')) {
            const mixinKeys = m.mixin;
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
    for (const modelproperty in model.model) {
        if (Object.prototype.hasOwnProperty.call(model.model, modelproperty)) {
            const element = model.model[modelproperty];
            check(element);
        }
    }
}
function executeIncludes(model, modelPath) {
    const check = (m) => {
        if (m === null || m === undefined)
            return;
        if (Object.prototype.hasOwnProperty.call(m, 'include')) {
            const includePath = path_1.default.resolve(path_1.default.join(path_1.default.dirname(modelPath), m.include));
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
    for (const modelproperty in model) {
        if (Object.prototype.hasOwnProperty.call(model, modelproperty)) {
            const element = model[modelproperty];
            check(element);
        }
    }
}
function load(modelPath) {
    const resolvedPath = path_1.default.resolve(modelPath);
    const model = (0, require_helper_1.requireNew)(resolvedPath);
    executeIncludes(model, modelPath);
    executeMixins(model);
    return model;
}
//# sourceMappingURL=model.js.map