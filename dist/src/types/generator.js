"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isGenerateStep = isGenerateStep;
exports.isCopyStep = isCopyStep;
exports.isCommandStep = isCommandStep;
function isGenerateStep(step) {
    return 'generate' in step;
}
function isCopyStep(step) {
    return 'copy' in step;
}
function isCommandStep(step) {
    return 'runCommand' in step;
}
//# sourceMappingURL=generator.js.map