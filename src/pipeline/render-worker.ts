/**
 * Worker thread for parallel template rendering.
 * Each worker loads models and renders templates independently —
 * no model serialization needed since workers require() from disk.
 */
import { parentPort } from 'worker_threads';
import path from 'path';
import handlebars from '../template-engine';
import * as jph from '../jsonpath-helper';

interface BatchRenderRequest {
  id: number;
  modelPath: string;
  jsonPath: string;
  templatePath: string;
  fileNamePattern: string;
  partials: string[];
  partialsDir: string;
  touch: boolean;
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
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const modelCache = new Map<string, any>();
const fileCache = new Map<string, HandlebarsTemplateDelegate>();
const patternCache = new Map<string, HandlebarsTemplateDelegate>();

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

parentPort!.on('message', (msg: BatchRenderRequest) => {
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
    const template = getTemplate(msg.templatePath);
    const fs = require('fs');

    const results: RenderResult[] = [];
    for (const item of items) {
      const filename = path.resolve(fileNameTemplate(item));

      // Skip touch files that already exist
      if (msg.touch && fs.existsSync(filename)) {
        continue;
      }

      const content = template(item);
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
