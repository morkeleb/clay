/**
 * Worker thread for parallel template rendering.
 * Each worker loads models and renders templates independently —
 * no model serialization needed since workers require() from disk.
 * Supports Handlebars, EJS, and TypeScript CodeGenerator engines.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { parentPort } from 'worker_threads';
import path from 'path';
import handlebars from '../template-engine';
import { getHelpers } from '../helpers';
import * as jph from '../jsonpath-helper';

// Workers are background renderers — suppress console output to avoid
// interleaving with the main thread's progress display.
// eslint-disable-next-line @typescript-eslint/no-empty-function
console.log = () => {};
// eslint-disable-next-line @typescript-eslint/no-empty-function
console.warn = () => {};

interface BatchRenderRequest {
  id: number;
  modelPath: string;
  jsonPath: string;
  templatePath: string;
  fileNamePattern: string;
  partials: string[];
  partialsDir: string;
  touch: boolean;
  engine?: 'handlebars' | 'ejs' | 'ts';
}

interface RenderResult {
  filename: string;
  content: string;
}

interface BatchRenderResponse {
  id: number;
  results: RenderResult[];
  error?: string;
}

// Track which partial dirs have been loaded
const loadedPartialDirs = new Set<string>();

// Caches (per worker) — model loaded once, templates compiled once
const modelCache = new Map<string, any>();
const fileCache = new Map<string, HandlebarsTemplateDelegate>();
const patternCache = new Map<string, HandlebarsTemplateDelegate>();
const ejsFileCache = new Map<string, string>();

// Lazy-loaded EJS module (per worker)
let ejs: any = null;
function getEjs(): any {
  if (!ejs) {
    try {
      ejs = require('ejs');
    } catch {
      throw new Error("EJS engine requires the 'ejs' package. Install it with: npm install ejs");
    }
  }
  return ejs;
}

// Lazy-loaded jiti instance (per worker)
let jitiInstance: any = null;
function getJiti(): any {
  if (!jitiInstance) {
    const { createJiti } = require('jiti');
    jitiInstance = createJiti(__filename, { interopDefault: true });
  }
  return jitiInstance;
}

function getTemplate(filePath: string): HandlebarsTemplateDelegate {
  if (!fileCache.has(filePath)) {
    const fs = require('fs');
    const content = fs.readFileSync(filePath, 'utf8');
    fileCache.set(filePath, handlebars.compile(content));
  }
  return fileCache.get(filePath)!;
}

function getPatternTemplate(pattern: string): HandlebarsTemplateDelegate {
  if (!patternCache.has(pattern)) {
    const normalized = pattern.split(path.sep).join('/');
    patternCache.set(pattern, handlebars.compile(normalized));
  }
  return patternCache.get(pattern)!;
}

function getEjsFileContent(filePath: string): string {
  if (!ejsFileCache.has(filePath)) {
    const fs = require('fs');
    ejsFileCache.set(filePath, fs.readFileSync(filePath, 'utf8'));
  }
  return ejsFileCache.get(filePath)!;
}

parentPort!.on('message', async (msg: BatchRenderRequest) => {
  try {
    // Load partials if not already loaded for this directory
    if (msg.partials.length > 0 && msg.partialsDir && !loadedPartialDirs.has(msg.partialsDir)) {
      handlebars.load_partials(msg.partials, msg.partialsDir);
      loadedPartialDirs.add(msg.partialsDir);
    }

    // Load model (cached per worker — only loaded once per unique path)
    if (!modelCache.has(msg.modelPath)) {
      modelCache.set(msg.modelPath, require('../model').load(msg.modelPath));
    }
    const model = modelCache.get(msg.modelPath);

    // Select items via JSONPath
    const items = jph.select(model, msg.jsonPath);

    const fileNameTemplate = getPatternTemplate(msg.fileNamePattern);
    const fs = require('fs');
    const engine = msg.engine ?? 'handlebars';
    const helpers = engine !== 'handlebars' ? getHelpers() : null;

    // Pre-load template/module for all engines (shared across items in batch)
    let hbsTemplate: HandlebarsTemplateDelegate | null = null;
    let ejsContent: string | null = null;
    let TsGeneratorClass: any = null;
    if (engine === 'handlebars') {
      hbsTemplate = getTemplate(msg.templatePath);
    } else if (engine === 'ejs') {
      ejsContent = getEjsFileContent(msg.templatePath);
    } else if (engine === 'ts') {
      const jiti = getJiti();
      const mod = await jiti.import(msg.templatePath);
      TsGeneratorClass = (mod as any).default ?? mod;
      if (typeof TsGeneratorClass !== 'function') {
        throw new Error(`Template ${msg.templatePath} must export a default class with a render() method`);
      }
    }

    const results: RenderResult[] = [];
    for (const item of items) {
      const filename = path.resolve(fileNameTemplate(item));

      // Skip touch files that already exist
      if (msg.touch && fs.existsSync(filename)) {
        continue;
      }

      let content: string;
      switch (engine) {
        case 'handlebars':
          content = hbsTemplate!(item);
          break;
        case 'ejs': {
          const ejsMod = getEjs();
          content = ejsMod.render(ejsContent!, { ...item, helpers }, { filename: msg.templatePath });
          break;
        }
        case 'ts': {
          const instance = new TsGeneratorClass();
          if (typeof instance.render !== 'function') {
            throw new Error(`Template ${msg.templatePath} must export a class extending CodeGenerator with a render(context: RenderContext) method`);
          }
          if (instance.render.length < 1) {
            throw new Error(`Template ${msg.templatePath} render() must accept a RenderContext argument`);
          }
          const result = await instance.render({
            data: item,
            helpers: helpers!,
            model: item.clay_model ?? {},
            parent: item.clay_parent,
          });
          if (typeof result !== 'string') {
            throw new Error(`Template ${msg.templatePath} render() must return a string, got ${typeof result}`);
          }
          content = result;
          break;
        }
        default:
          throw new Error(`Unknown template engine: ${engine}`);
      }

      results.push({ filename, content });
    }

    const response: BatchRenderResponse = { id: msg.id, results };
    parentPort!.postMessage(response);
  } catch (e) {
    const response: BatchRenderResponse = {
      id: msg.id,
      results: [],
      error: e instanceof Error ? e.message : String(e),
    };
    parentPort!.postMessage(response);
  }
});
