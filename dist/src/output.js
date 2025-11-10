"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.watch = watch;
exports.move = move;
exports.copy = copy;
exports.log = log;
exports.execute = execute;
exports.info = info;
exports.write = write;
exports.warn = warn;
exports.critical = critical;
const chalk_1 = __importDefault(require("chalk"));
function watch(target) {
    if (!process.isCLI)
        return;
    console.log(chalk_1.default.cyan('watching: '), target);
}
function move(target, dest) {
    if (!process.isCLI)
        return;
    console.log(chalk_1.default.green('moving: '), target, chalk_1.default.green(' -> '), dest);
}
function copy(target, dest) {
    if (!process.isCLI)
        return;
    console.log(chalk_1.default.magenta('copying: '), target, chalk_1.default.magenta(' -> '), dest);
}
function log(...text) {
    if (!process.isCLI)
        return;
    if (text[0])
        text[0] = chalk_1.default.yellow(text[0]);
    console.log.apply(console, text);
}
function execute(...text) {
    if (!process.isCLI)
        return;
    text.unshift(chalk_1.default.blue('executing: '));
    console.log.apply(console, text);
}
function info(...text) {
    if (!process.isCLI)
        return;
    text.unshift(chalk_1.default.blue('info: '));
    console.log.apply(console, text);
}
function write(...filename) {
    if (!process.isCLI)
        return;
    filename.unshift(chalk_1.default.green('writing: '));
    console.log.apply(console, filename);
}
function warn(...text) {
    if (!process.isCLI)
        return;
    text.unshift(chalk_1.default.red('Warning! '));
    console.warn.apply(console, text);
}
function critical(...text) {
    if (!process.isCLI)
        return;
    text.unshift(chalk_1.default.red('CRITICAL! '));
    console.warn.apply(console, text);
    process.exit();
}
//# sourceMappingURL=output.js.map