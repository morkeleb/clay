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
const fs_extra_1 = __importDefault(require("fs-extra"));
const path_1 = __importDefault(require("path"));
const template_engine_1 = __importDefault(require("./template-engine"));
const ui = __importStar(require("./output"));
const lodash_1 = __importDefault(require("lodash"));
const child_process_1 = require("child_process");
const jph = __importStar(require("./jsonpath-helper"));
const require_helper_1 = require("./require-helper");
const minimatch_1 = __importDefault(require("minimatch"));
const crypto_1 = __importDefault(require("crypto"));
const zod_1 = require("zod");
const jsonpath_1 = __importDefault(require("jsonpath"));
const output = __importStar(require("./output"));
const isValidJsonPath = (jsonPath) => {
    try {
        jsonpath_1.default.parse(jsonPath);
        return { valid: true };
    }
    catch (error) {
        return { valid: false, error: error.message };
    }
};
const SelectSchema = zod_1.z
    .string()
    .optional()
    .superRefine((jsonPath, ctx) => {
    if (jsonPath && !isValidJsonPath(jsonPath).valid) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            message: `Invalid JSONPath in 'select': ${jsonPath}`,
        });
    }
});
const GeneratorStepSchema = zod_1.z.union([
    zod_1.z.object({
        generate: zod_1.z.string(),
        touch: zod_1.z.boolean().optional(),
        select: SelectSchema,
        target: zod_1.z.string().optional(),
    }),
    zod_1.z.object({
        copy: zod_1.z.string(),
        select: SelectSchema,
        target: zod_1.z.string().optional(),
    }),
    zod_1.z.object({
        runCommand: zod_1.z.string(),
        select: SelectSchema,
        npxCommand: zod_1.z.boolean().optional(),
        verbose: zod_1.z.boolean().optional(),
    }),
]);
const GeneratorSchema = zod_1.z.object({
    steps: zod_1.z.array(GeneratorStepSchema),
    partials: zod_1.z.array(zod_1.z.string()).optional(),
    formatters: zod_1.z
        .array(zod_1.z.union([
        zod_1.z.string(),
        zod_1.z.object({
            package: zod_1.z.string(),
            options: zod_1.z.record(zod_1.z.any()).optional(),
        }),
    ]))
        .optional(),
});
function validateGeneratorSchema(generator) {
    const result = GeneratorSchema.safeParse(generator);
    if (!result.success) {
        const detailedErrors = result.error.issues.map((issue) => {
            const pathStr = issue.path.join('.');
            const message = `Error in path '${pathStr}': ${issue.message}`;
            output.warn(message);
            return message;
        });
        throw new Error(`Invalid generator schema:\n${detailedErrors.join('\n')}`);
    }
    return result.data;
}
function getMd5ForContent(content) {
    return crypto_1.default.createHash('md5').update(content).digest('hex');
}
async function applyFormatters(generator, file_name, data, step) {
    const resolveGlobal = require('resolve-global');
    const formatters = generator.formatters || [];
    let result = data;
    const formatterSpecs = formatters.map((fmt) => {
        if (typeof fmt === 'string') {
            return { pkg: fmt, options: {}, new: false };
        }
        return {
            pkg: fmt.package,
            options: fmt.options || {},
            new: true,
        };
    });
    const loadedFormatters = formatterSpecs.map(({ pkg }) => require(resolveGlobal(pkg)));
    for (let i = 0; i < loadedFormatters.length; i++) {
        const formatter = loadedFormatters[i];
        const { options } = formatterSpecs[i];
        const { new: isNewFormatter } = formatterSpecs[i];
        const applyFormatter = Array.isArray(formatter.extensions)
            ? formatter.extensions.some((ext) => (0, minimatch_1.default)(file_name, ext))
            : true;
        if (!applyFormatter)
            continue;
        try {
            if (isNewFormatter) {
                result = await formatter.apply(file_name, result, options, step);
            }
            else {
                result = await formatter.apply(file_name, result);
            }
        }
        catch (e) {
            ui.critical('Failed to apply formatter for:', file_name, 'This is probably not due to Clay but the formatter itself', e);
            throw e;
        }
    }
    return result;
}
function write(file, data) {
    const dir = path_1.default.dirname(file);
    fs_extra_1.default.ensureDirSync(dir);
    ui.write(file);
    fs_extra_1.default.writeFileSync(file, data, 'utf8');
}
async function generate_file(generator, model_partial, directory, outputDir, file, modelIndex, step) {
    const template = template_engine_1.default.compile(fs_extra_1.default.readFileSync(path_1.default.join(directory, file), 'utf8'));
    const file_name = template_engine_1.default.compile(path_1.default.join(outputDir, file));
    await Promise.all(model_partial.map(async (m) => {
        const filename = file_name(m);
        if (step.touch && fs_extra_1.default.existsSync(filename)) {
            ui.info('skipping touch file:', filename);
            return;
        }
        try {
            const preFormattedOutput = template(m);
            const md5 = getMd5ForContent(preFormattedOutput);
            if (modelIndex.getFileCheckSum(filename) !== md5) {
                const content = await applyFormatters(generator, filename, preFormattedOutput, step);
                write(filename, content);
                if (!step.touch) {
                    modelIndex.setFileCheckSum(filename, md5);
                }
            }
        }
        catch (e) {
            ui.critical('Failed to generate content for: ', filename, ' This probably not due to clay but the template itself', e);
            throw e;
        }
    }));
}
function remove_file(modelIndex, file) {
    ui.warn('removing ', file);
    if (fs_extra_1.default.existsSync(file)) {
        fs_extra_1.default.removeSync(file);
    }
    modelIndex.delFileCheckSum(file);
}
async function generate_directory(generator, model_partial, directory, outputDir, modelIndex, step) {
    const templates = fs_extra_1.default.readdirSync(directory);
    await Promise.all(templates
        .filter((file) => fs_extra_1.default.lstatSync(path_1.default.join(directory, file)).isDirectory())
        .map((file) => generate_directory(generator, model_partial, path_1.default.join(directory, file), path_1.default.join(outputDir, file), modelIndex, step)));
    await Promise.all(templates
        .filter((file) => fs_extra_1.default.lstatSync(path_1.default.join(directory, file)).isFile())
        .map((file) => generate_file(generator, model_partial, directory, outputDir, file, modelIndex, step)));
}
function execute(commandline, output_dir, npxCommand, verbose) {
    let cmd = commandline;
    if (npxCommand) {
        cmd = `npx ${commandline}`;
    }
    ui.execute(cmd);
    try {
        (0, child_process_1.execSync)(cmd, {
            cwd: output_dir,
            stdio: verbose ? 'inherit' : 'pipe',
        });
    }
    catch (e) {
        ui.warn('error while executing', commandline);
        if (e.stdout) {
            ui.warn(e.stdout.toString());
        }
    }
}
function generate_template(generator, step, model, outputDir, dirname, modelIndex) {
    if (fs_extra_1.default.lstatSync(path_1.default.join(dirname, step.generate)).isFile()) {
        return generate_file(generator, jph.select(model, step.select), path_1.default.join(dirname, path_1.default.dirname(step.generate)), path_1.default.join(outputDir, step.target || ''), path_1.default.basename(step.generate), modelIndex, step);
    }
    else {
        return generate_directory(generator, jph.select(model, step.select), path_1.default.join(dirname, step.generate), path_1.default.join(outputDir, step.target || ''), modelIndex, step);
    }
}
function remove_generated_files(modelIndex) {
    const files = Object.keys(modelIndex.generated_files);
    files.forEach((f) => remove_file(modelIndex, f));
}
function run_command(step, model, outputDir, _dirname) {
    const output_dir = path_1.default.resolve(outputDir);
    fs_extra_1.default.ensureDirSync(output_dir);
    const verbose = step.verbose !== undefined ? step.verbose : !!process.env.VERBOSE;
    if (step.select === undefined) {
        execute(step.runCommand, output_dir, step.npxCommand, verbose);
    }
    else {
        const command = template_engine_1.default.compile(step.runCommand);
        jph.select(model, step.select).forEach((m) => {
            execute(command(m), output_dir, step.npxCommand, verbose);
        });
    }
}
function addToIndex(modelIndex, file) {
    if (!modelIndex.generated_files[file]) {
        modelIndex.generated_files[file] = {
            md5: '',
            date: new Date().toISOString(),
        };
    }
}
function cleanEmptyDirectories(directory) {
    if (fs_extra_1.default.existsSync(directory) && fs_extra_1.default.lstatSync(directory).isDirectory()) {
        const files = fs_extra_1.default.readdirSync(directory);
        if (files.length === 0) {
            fs_extra_1.default.rmdirSync(directory);
            ui.warn('Removed empty directory', directory);
        }
    }
}
function copy(step, model, outputDir, dirname, modelIndex) {
    const output_dir = path_1.default.resolve(outputDir);
    const source = path_1.default.resolve(path_1.default.join(dirname, step.copy));
    if (step.select === undefined) {
        let out;
        if (step.target) {
            out = path_1.default.join(output_dir, step.target);
        }
        else {
            out = output_dir;
        }
        if (fs_extra_1.default.lstatSync(source).isFile()) {
            out = path_1.default.join(out, path_1.default.basename(step.copy));
        }
        fs_extra_1.default.ensureDirSync(output_dir);
        ui.copy(source, out);
        fs_extra_1.default.copySync(source, out);
        addToIndex(modelIndex, out);
    }
    else {
        jph.select(model, step.select).forEach((m) => {
            let out;
            if (step.target) {
                const target = template_engine_1.default.compile(step.target);
                out = path_1.default.join(output_dir, target(m));
            }
            else {
                out = output_dir;
            }
            fs_extra_1.default.ensureDirSync(output_dir);
            ui.copy(source, out);
            fs_extra_1.default.copySync(source, out);
            addToIndex(modelIndex, out);
            const recursiveHandlebars = (p) => {
                fs_extra_1.default.readdirSync(p).forEach((f) => {
                    const file = path_1.default.join(p, f);
                    if (fs_extra_1.default.lstatSync(file).isDirectory()) {
                        recursiveHandlebars(file);
                    }
                    else {
                        const template = template_engine_1.default.compile(file);
                        ui.move(source, out);
                        const template_path = template(m);
                        if (file !== template_path) {
                            fs_extra_1.default.moveSync(file, template_path);
                            addToIndex(modelIndex, template_path);
                        }
                    }
                });
            };
            recursiveHandlebars(out);
        });
    }
}
function decorate_generator(g, p, extra_output, modelIndex) {
    validateGeneratorSchema(g);
    const decorated = g;
    decorated.generate = async (model, outputDir) => {
        const output = path_1.default.join(outputDir, extra_output || '');
        const dirname = path_1.default.dirname(p);
        template_engine_1.default.load_partials(g.partials || [], dirname);
        for (let index = 0; index < g.steps.length; index++) {
            const step = g.steps[index];
            if ('generate' in step) {
                await generate_template(g, step, lodash_1.default.cloneDeep(model), output, dirname, modelIndex);
            }
            else if ('runCommand' in step) {
                run_command(step, lodash_1.default.cloneDeep(model), output, dirname);
            }
            else if ('copy' in step) {
                copy(step, lodash_1.default.cloneDeep(model), output, dirname, modelIndex);
            }
        }
    };
    decorated.clean = (_model, _outputDir) => {
        remove_generated_files(modelIndex);
        Object.keys(modelIndex.generated_files).forEach((file) => {
            const dir = path_1.default.dirname(file);
            cleanEmptyDirectories(dir);
        });
    };
    return decorated;
}
function load(p, extra_output, index) {
    const generator = (0, require_helper_1.requireNew)(path_1.default.resolve(p));
    return decorate_generator(generator, p, extra_output, index);
}
//# sourceMappingURL=generator.js.map