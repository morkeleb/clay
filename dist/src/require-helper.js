"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireNew = requireNew;
const path_1 = __importDefault(require("path"));
function requireNew(modulePath) {
    const resolvedPath = path_1.default.resolve(modulePath);
    delete require.cache[resolvedPath];
    return require(modulePath);
}
exports.default = requireNew;
//# sourceMappingURL=require-helper.js.map