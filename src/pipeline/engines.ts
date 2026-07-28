/**
 * Template engine renderers for Handlebars, EJS, and TypeScript.
 * Each engine receives model data and helpers, returns rendered content.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

import fs from 'fs';
import { getCompiledTemplate } from './template-cache';
import { getHelpers } from '../helpers';
import type { ClayHelpers } from '../code-generator';

// Lazy-loaded EJS module
let ejs: typeof import('ejs') | null = null;

function getEjs(): typeof import('ejs') {
  if (!ejs) {
    try {
      ejs = require('ejs');
    } catch {
      throw new Error(
        "EJS engine requires the 'ejs' package. Install it with: npm install ejs"
      );
    }
  }
  return ejs!;
}

// Lazy-loaded jiti instance
let jitiInstance: any = null;

function getJiti(): any {
  if (!jitiInstance) {
    const { createJiti } = require('jiti');
    jitiInstance = createJiti(__filename, { interopDefault: true });
  }
  return jitiInstance;
}

// EJS file content cache
const ejsFileCache = new Map<string, string>();

function getEjsFileContent(filePath: string): string {
  if (!ejsFileCache.has(filePath)) {
    ejsFileCache.set(filePath, fs.readFileSync(filePath, 'utf8'));
  }
  return ejsFileCache.get(filePath)!;
}

/**
 * Clear engine caches. Called at the start of each generation run and before
 * orphan-refresh second passes.
 *
 * Resets the jiti instance so edited `engine: 'ts'` templates are re-read from
 * disk (important for the long-running MCP server). Also ensures second-pass
 * refresh after orphan deletes does not freeze a first-pass module snapshot.
 * Disk inventory in TS templates should still be read inside `render()`, not at
 * module load.
 */
export function clearEngineCaches(): void {
  ejsFileCache.clear();
  jitiInstance = null;
}

/**
 * Render using Handlebars (existing behavior).
 */
function renderHandlebars(templatePath: string, modelData: unknown): string {
  const template = getCompiledTemplate(templatePath);
  return template(modelData);
}

/**
 * Render using EJS with Clay helpers available as `helpers`.
 */
function renderEjs(
  templatePath: string,
  modelData: unknown,
  helpers: ClayHelpers
): string {
  const ejsMod = getEjs();
  const templateContent = getEjsFileContent(templatePath);
  return ejsMod.render(
    templateContent,
    {
      ...(modelData as Record<string, any>),
      helpers,
    },
    {
      filename: templatePath,
    }
  );
}

/**
 * Render using TypeScript/JavaScript CodeGenerator class via jiti.
 */
async function renderTs(
  templatePath: string,
  modelData: unknown,
  helpers: ClayHelpers
): Promise<string> {
  const jiti = getJiti();
  const mod = await jiti.import(templatePath);
  const ExportedClass = (mod as any).default ?? mod;

  if (typeof ExportedClass !== 'function') {
    throw new Error(
      `Template ${templatePath} must export a default class extending CodeGenerator`
    );
  }

  const instance = new ExportedClass();

  if (typeof instance.render !== 'function') {
    throw new Error(
      `Template ${templatePath} must export a class extending CodeGenerator with a render(context: RenderContext) method`
    );
  }

  if (instance.render.length < 1) {
    throw new Error(
      `Template ${templatePath} render() must accept a RenderContext argument`
    );
  }

  const data = modelData as Record<string, any>;
  const result = await instance.render({
    data,
    helpers,
    model: data.clay_model ?? {},
    parent: data.clay_parent,
  });

  if (typeof result !== 'string') {
    throw new Error(
      `Template ${templatePath} render() must return a string, got ${typeof result}`
    );
  }

  return result;
}

/**
 * Dispatch to the appropriate template engine.
 */
export async function renderWithEngine(
  engine: string,
  templatePath: string,
  modelData: unknown
): Promise<string> {
  try {
    switch (engine) {
      case 'handlebars':
        return renderHandlebars(templatePath, modelData);
      case 'ejs':
        return renderEjs(templatePath, modelData, getHelpers());
      case 'ts':
        return renderTs(templatePath, modelData, getHelpers());
      default:
        throw new Error(`Unknown template engine: ${engine}`);
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    throw new Error(`[${templatePath}] ${message}`);
  }
}
