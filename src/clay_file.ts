import fs from 'fs';
import path from 'path';
import _ from 'lodash';
import * as output from './output';
import type { ClayFile, ClayModelEntry } from './types/clay-file';

const emptyIndex: ClayFile = { models: [] };

const newModelEntry = (
  modelPath: string,
  outputPath?: string
): ClayModelEntry => ({
  path: modelPath,
  output: outputPath || '',
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

export function load(directory: string): ClayFileManager {
  const filePath = path.join(directory, '.clay');
  const indexExists = fs.existsSync(filePath);
  const fileContent = indexExists ? fs.readFileSync(filePath) : null;
  const data: ClayFile =
    gitMergeAcceptAllIncomingChanges(fileContent) || emptyIndex;

  function getModelIndex(
    modelPath: string,
    outputPath?: string
  ): ClayModelEntry {
    const resolvedOutput = outputPath || '';
    let model = _.find(
      data.models,
      (m) => m.path === modelPath && m.output === resolvedOutput
    );
    if (!model) {
      model = newModelEntry(modelPath, resolvedOutput);
      data.models.push(model);
    }

    function getFileCheckSum(file: string): string | null {
      const relFile = path.relative(process.cwd(), file);
      // Normalize to forward slashes for cross-platform compatibility
      const normalizedPath = relFile.split(path.sep).join('/');
      return _.get(model, "generated_files['" + normalizedPath + "'].md5", null);
    }

    function setFileCheckSum(file: string, md5: string): void {
      const relFile = path.relative(process.cwd(), file);
      // Normalize to forward slashes for cross-platform compatibility
      const normalizedPath = relFile.split(path.sep).join('/');
      const date = new Date().toISOString();
      _.set(model!, "generated_files['" + normalizedPath + "'].md5", md5);
      _.set(model!, "generated_files['" + normalizedPath + "'].date", date);
      model!.last_generated = date;
    }

    model.setFileCheckSum = setFileCheckSum;
    model.getFileCheckSum = getFileCheckSum;
    model.delFileCheckSum = (file: string) => {
      const relFile = path.relative(process.cwd(), file);
      // Normalize to forward slashes for cross-platform compatibility
      const normalizedPath = relFile.split(path.sep).join('/');
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

export function createClayFile(directory: string): void {
  const clayFilePath = path.join(directory, '.clay');
  if (fs.existsSync(clayFilePath)) {
    throw new Error('A .clay file already exists in this folder.');
  }
  fs.writeFileSync(clayFilePath, JSON.stringify({ models: [] }), 'utf8');
  output.write('.clay file has been created successfully.');
}
