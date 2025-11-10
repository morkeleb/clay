#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
process.isCLI = require.main === module;
const command_line_1 = __importDefault(require("./src/command-line"));
command_line_1.default.parse(process.argv);
if (!process.argv.slice(2).length) {
    command_line_1.default.outputHelp();
}
//# sourceMappingURL=index.js.map