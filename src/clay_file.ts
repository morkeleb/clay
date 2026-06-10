import fs from 'fs';
import path from 'path';
import _ from 'lodash';
import * as output from './output';
import type { ClayFile, ClayModelEntry } from './types/clay-file';

const emptyIndex: ClayFile = { models: [] };

/**
 * Canonicalize a path for consistent .clay lookups.
 * Strips leading ./, normalizes separators to POSIX, removes trailing /.
 * Empty string becomes ".".
 */
function canonicalizePath(p: string | undefined): string {
  if (!p || p === '') return '.';
  // Normalize to POSIX forward slashes
  let normalized = p.split(path.sep).join('/');
  // Strip leading ./
  normalized = normalized.replace(/^\.\//, '');
  // Strip trailing /
  normalized = normalized.replace(/\/+$/, '');
  // Empty after stripping becomes "."
  return normalized || '.';
}

const newModelEntry = (
  modelPath: string,
  outputPath?: string
): ClayModelEntry => ({
  path: canonicalizePath(modelPath),
  output: canonicalizePath(outputPath),
  generated_files: {},
  setFileCheckSum: () => {},
  getFileCheckSum: () => null,
  delFileCheckSum: () => {},
  load: () => ({}),
});

const gitMergeAcceptAllIncomingChanges = (
  fileContent: Buffer | null
): ClayFile | null => {
  if (!fileContent) return null;
  const mergeTagRegex =
    /<<<<<<< HEAD([\s\S]*?)=======([\s\S]*?)>>>>>>> ([^\n]+)/g;
  const cleanContent = fileContent.toString().replace(mergeTagRegex, '$2');
  return JSON.parse(cleanContent);
};

interface ClayFileManager {
  models: ClayModelEntry[];
  getModelIndex: (modelPath: string, output?: string) => ClayModelEntry;
  save: () => void;
}

/**
 * Heal a .clay file on load:
 * - Deduplicate model entries with the same canonical path+output
 * - Normalize path and output fields to canonical form
 * - Convert absolute generated_files keys to relative
 */
function healClayData(data: ClayFile): ClayFile {
  const seen = new Map<string, ClayModelEntry>();

  for (const model of data.models) {
    const key = `${canonicalizePath(model.path)}::${canonicalizePath(model.output)}`;
    const existing = seen.get(key);

    if (existing) {
      // Merge generated_files: keep the entry with more files, union the rest
      for (const [file, entry] of Object.entries(model.generated_files || {})) {
        const canonicalFile = file.split(path.sep).join('/');
        const existingEntry = existing.generated_files[canonicalFile];
        if (!existingEntry || (entry.date && (!existingEntry.date || entry.date > existingEntry.date))) {
          existing.generated_files[canonicalFile] = entry;
        }
      }
      // Keep the newer last_generated / input_hash
      if (model.last_generated && (!existing.last_generated || model.last_generated > existing.last_generated)) {
        existing.last_generated = model.last_generated;
      }
      if (model.input_hash && !existing.input_hash) {
        existing.input_hash = model.input_hash;
      }
    } else {
      // Normalize path and output
      model.path = canonicalizePath(model.path);
      model.output = canonicalizePath(model.output);

      // Convert absolute paths in generated_files to relative
      const healed: Record<string, { md5: string; date: string }> = {};
      for (const [file, entry] of Object.entries(model.generated_files || {})) {
        let normalizedFile = file;
        // Strip absolute paths — convert to relative from cwd
        if (path.isAbsolute(file)) {
          normalizedFile = path.relative(process.cwd(), file);
        }
        // Normalize to forward slashes
        normalizedFile = normalizedFile.split(path.sep).join('/');
        healed[normalizedFile] = entry;
      }
      model.generated_files = healed;

      seen.set(key, model);
    }
  }

  data.models = [...seen.values()];
  return data;
}

export function load(directory: string): ClayFileManager {
  const filePath = path.join(directory, '.clay');
  const indexExists = fs.existsSync(filePath);
  const fileContent = indexExists ? fs.readFileSync(filePath) : null;
  const data: ClayFile =
    healClayData(gitMergeAcceptAllIncomingChanges(fileContent) || emptyIndex);

  function getModelIndex(
    modelPath: string,
    outputPath?: string
  ): ClayModelEntry {
    const canonicalPath = canonicalizePath(modelPath);
    const canonicalOutput = canonicalizePath(outputPath);

    // Find existing entry using canonical comparison — handles ./clay/foo.json vs clay/foo.json etc.
    let model = _.find(
      data.models,
      (m) => canonicalizePath(m.path) === canonicalPath && canonicalizePath(m.output) === canonicalOutput
    );

    if (!model) {
      model = newModelEntry(modelPath, outputPath);
      data.models.push(model);
    } else {
      // Heal existing entry: normalize stored path/output to canonical form
      model.path = canonicalPath;
      model.output = canonicalOutput;
    }

    function normalizeFilePath(file: string): string {
      const relFile = path.relative(process.cwd(), file);
      return relFile.split(path.sep).join('/');
    }

    function getFileCheckSum(file: string): string | null {
      const normalizedPath = normalizeFilePath(file);
      return _.get(model, "generated_files['" + normalizedPath + "'].md5", null);
    }

    function setFileCheckSum(file: string, md5: string): void {
      const normalizedPath = normalizeFilePath(file);
      const date = new Date().toISOString();
      _.set(model!, "generated_files['" + normalizedPath + "'].md5", md5);
      _.set(model!, "generated_files['" + normalizedPath + "'].date", date);
      model!.last_generated = date;
    }

    model.setFileCheckSum = setFileCheckSum;
    model.getFileCheckSum = getFileCheckSum;
    model.delFileCheckSum = (file: string) => {
      const normalizedPath = normalizeFilePath(file);
      delete model!.generated_files[normalizedPath];
    };
    model.load = () => require('./model').load(modelPath);

    return model;
  }

  function save(): void {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  }

  return {
    models: data.models,
    getModelIndex,
    save,
  };
}

export interface CreateClayFileOptions {
  gitattributes?: boolean;
  automerge?: boolean;
}

export function createClayFile(
  directory: string,
  options: CreateClayFileOptions = {}
): void {
  const clayFilePath = path.join(directory, '.clay');
  if (fs.existsSync(clayFilePath)) {
    throw new Error('A .clay file already exists in this folder.');
  }
  const config: Record<string, boolean> = {};
  if (options.gitattributes) config.gitattributes = true;
  if (options.automerge) config.automerge = true;
  const data = { ...config, models: [] as never[] };
  fs.writeFileSync(clayFilePath, JSON.stringify(data, null, 2), 'utf8');
  output.write('.clay file has been created successfully.');
}

export const VALID_CONFIG_KEYS = ['gitattributes', 'automerge'] as const;
export type ClayConfigKey = (typeof VALID_CONFIG_KEYS)[number];

export function updateClayConfig(
  directory: string,
  key: ClayConfigKey,
  value: boolean
): void {
  const clayFilePath = path.join(directory, '.clay');
  if (!fs.existsSync(clayFilePath)) {
    throw new Error('No .clay file found. Run clay init first.');
  }
  if (!VALID_CONFIG_KEYS.includes(key)) {
    throw new Error(
      `Unknown config key: ${key}. Valid keys: ${VALID_CONFIG_KEYS.join(', ')}`
    );
  }
  const data = JSON.parse(fs.readFileSync(clayFilePath, 'utf8'));
  if (value) {
    data[key] = value;
  } else {
    delete data[key];
  }
  fs.writeFileSync(clayFilePath, JSON.stringify(data, null, 2), 'utf8');
}
