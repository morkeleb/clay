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
exports.load = load;
exports.createClayFile = createClayFile;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const lodash_1 = __importDefault(require("lodash"));
const output = __importStar(require("./output"));
const emptyIndex = { models: [] };
const newModelEntry = (modelPath, outputPath) => ({
    path: modelPath,
    output: outputPath || '',
    generated_files: {},
    setFileCheckSum: () => { },
    getFileCheckSum: () => null,
    delFileCheckSum: () => { },
    load: () => ({}),
});
const gitMergeAcceptAllIncomingChanges = (fileContent) => {
    if (!fileContent)
        return null;
    const mergeTagRegex = /<<<<<<< HEAD([\s\S]*?)=======([\s\S]*?)>>>>>>> ([^\n]+)/g;
    const cleanContent = fileContent.toString().replace(mergeTagRegex, '$2');
    return JSON.parse(cleanContent);
};
function load(directory) {
    const filePath = path_1.default.join(directory, '.clay');
    const indexExists = fs_1.default.existsSync(filePath);
    const fileContent = indexExists ? fs_1.default.readFileSync(filePath) : null;
    const data = gitMergeAcceptAllIncomingChanges(fileContent) || emptyIndex;
    function getModelIndex(modelPath, outputPath) {
        const resolvedOutput = outputPath || '';
        let model = lodash_1.default.find(data.models, (m) => m.path === modelPath && m.output === resolvedOutput);
        if (!model) {
            model = newModelEntry(modelPath, resolvedOutput);
            data.models.push(model);
        }
        function getFileCheckSum(file) {
            return lodash_1.default.get(model, "generated_files['" + file + "'].md5", null);
        }
        function setFileCheckSum(file, md5) {
            const date = new Date().toISOString();
            lodash_1.default.set(model, "generated_files['" + file + "'].md5", md5);
            lodash_1.default.set(model, "generated_files['" + file + "'].date", date);
            model.last_generated = date;
        }
        model.setFileCheckSum = setFileCheckSum;
        model.getFileCheckSum = getFileCheckSum;
        model.delFileCheckSum = (file) => delete model.generated_files[file];
        model.load = () => require('./model').load(modelPath);
        return model;
    }
    function save() {
        fs_1.default.writeFileSync(filePath, JSON.stringify(data, null, 2));
    }
    return {
        models: data.models,
        getModelIndex,
        save,
    };
}
function createClayFile(directory) {
    const clayFilePath = path_1.default.join(directory, '.clay');
    if (fs_1.default.existsSync(clayFilePath)) {
        throw new Error('A .clay file already exists in this folder.');
    }
    fs_1.default.writeFileSync(clayFilePath, JSON.stringify({ models: [] }), 'utf8');
    output.write('.clay file has been created successfully.');
}
//# sourceMappingURL=clay_file.js.map