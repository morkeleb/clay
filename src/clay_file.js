const fs = require("fs");
const osPath = require("path");
const _ = require("lodash");

const emptyIndex = { models: [] };
const newModelEntry = (path, output) => ({
  path,
  output,
  generated_files: {},
});

module.exports = {
  load: (path) => {
    const filePath = osPath.join(path, ".clay");
    const indexExists = fs.existsSync(filePath);

    const data = indexExists
      ? JSON.parse(fs.readFileSync(filePath))
      : emptyIndex;

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
};
