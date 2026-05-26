/**
 * Worker thread for parallel Handlebars template rendering.
 * Each worker has its own Handlebars instance with all helpers registered.
 */
import { parentPort, workerData } from 'worker_threads';
import path from 'path';
import fs from 'fs';
import handlebars from '../template-engine';

interface RenderRequest {
  id: number;
  templatePath: string;
  fileNamePattern: string;
  modelData: unknown;
  partials?: string[];
  partialsDir?: string;
}

interface RenderResponse {
  id: number;
  filename: string;
  content: string;
  error?: string;
}

// Load partials once on worker startup
const { partials, partialsDir } = workerData as {
  partials: string[];
  partialsDir: string;
};
if (partials.length > 0 && partialsDir) {
  handlebars.load_partials(partials, partialsDir);
}

// Template caches (per worker)
const fileCache = new Map<string, HandlebarsTemplateDelegate>();
const patternCache = new Map<string, HandlebarsTemplateDelegate>();

function getTemplate(filePath: string): HandlebarsTemplateDelegate {
  if (!fileCache.has(filePath)) {
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

// Track which partials dirs have been loaded to avoid reloading
const loadedPartialDirs = new Set<string>();

parentPort!.on('message', (msg: RenderRequest) => {
  try {
    // Load partials if provided and not already loaded for this dir
    if (msg.partials && msg.partialsDir && !loadedPartialDirs.has(msg.partialsDir)) {
      handlebars.load_partials(msg.partials, msg.partialsDir);
      loadedPartialDirs.add(msg.partialsDir);
    }

    const fileNameTemplate = getPatternTemplate(msg.fileNamePattern);
    const filename = path.resolve(fileNameTemplate(msg.modelData));
    const template = getTemplate(msg.templatePath);
    const content = template(msg.modelData);

    const response: RenderResponse = { id: msg.id, filename, content };
    parentPort!.postMessage(response);
  } catch (e) {
    const response: RenderResponse = {
      id: msg.id,
      filename: '',
      content: '',
      error: e instanceof Error ? e.message : String(e),
    };
    parentPort!.postMessage(response);
  }
});
