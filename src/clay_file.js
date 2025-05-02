const fs = require("fs");
const osPath = require("path");
const _ = require("lodash");
const output = require("./output");

const emptyIndex = { models: [] };
const newModelEntry = (path, output) => ({
  path,
  output,
  generated_files: {},
});

const gitMergeAcceptAllIncomingChanges = (fileContent) => {
  if (!fileContent) return null;
  const mergeTagRegex =
    /<<<<<<< HEAD([\s\S]*?)=======([\s\S]*?)>>>>>>> ([^\n]+)/g;
  const cleanContent = fileContent.toString().replace(mergeTagRegex, "$2");
  return JSON.parse(cleanContent);
};

module.exports = {
  load: (path) => {
    const filePath = osPath.join(path, ".clay");
    const indexExists = fs.existsSync(filePath);
    const fileContent = indexExists ? fs.readFileSync(filePath) : null;
    const data = gitMergeAcceptAllIncomingChanges(fileContent) || emptyIndex;

    function getModelIndex(modelPath, output) {
      let model = _.find(
        data.models,
        (m) => m.path === modelPath && m.output === output
      );
      if (!model) {
        model = newModelEntry(modelPath, output);
        data.models.push(model);
      }
      function getFileCheckSum(filePath) {
        return _.get(model, "generated_files['" + filePath + "'].md5", null);
      }
      function setFileCheckSum(filePath, md5) {
        const date = new Date().toISOString();
        _.set(model, "generated_files['" + filePath + "'].md5", md5);
        _.set(model, "generated_files['" + filePath + "'].date", date);
        model.last_generated = date;
      }
      model.setFileCheckSum = setFileCheckSum;
      model.getFileCheckSum = getFileCheckSum;
      model.delFileCheckSum = (file) => delete model.generated_files[file];
      model.load = () => require("./model").load(modelPath);
      return model;
    }

    function save() {
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    }
    data.getModelIndex = getModelIndex;
    data.save = save;
    return data;
  },

  createClayFile: (directory) => {
    const clayFilePath = osPath.join(directory, ".clay");
    if (fs.existsSync(clayFilePath)) {
      throw new Error("A .clay file already exists in this folder.");
    }
    fs.writeFileSync(clayFilePath, JSON.stringify({ models: [] }), "utf8");
    output.write(".clay file has been created successfully.");
  },
};
