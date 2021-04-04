const path = require("path");
const { expect } = require("chai");
const clay_file = require("../src/clay_file.js");

describe("the clay file index system", () => {
  describe("the models portion", () => {
    it("keeps track of all models generatored and which params used", () => {
      const clay_index = clay_file.load("./test/samples");
      const fileMd5 = "32453245345";
      clay_index
        .getModelIndex("./test/include-example.json", "./tmp/test-output/")
        .setFileCheckSum("order.txt", fileMd5);
      expect(clay_index.models[1]).to.include({
        output: "./tmp/test-output/",
        path: "./test/include-example.json",
      });
    });
    it("keeps track of which files have been generated for the model", () => {
      const clay_index = clay_file.load("./test/samples");
      const fileMd5 = "32453245345";
      clay_index
        .getModelIndex("./test/include-example.json", "./tmp/test-output/")
        .setFileCheckSum("order.txt", fileMd5);
      expect(clay_index.models[1].generated_files["order.txt"]).to.include({
        md5: fileMd5,
      });
    });
    it("keeps the md5 checksum of the filecontent last generated for each file", () => {
      const clay_index = clay_file.load("./test/samples");
      const fileMd5 = "32453245345";
      clay_index
        .getModelIndex("./test/include-example.json", "./tmp/test-output/")
        .setFileCheckSum("order.txt", fileMd5);

      const resultMd5 = clay_index
        .getModelIndex("./test/include-example.json", "./tmp/test-output/")
        .getFileCheckSum("order.txt");

      expect(resultMd5).to.equal(fileMd5);
    });
  });
  describe("loading the generated file", () => {
    it("will check for a .clay file in the specified directory", () => {
      const clay_index = clay_file.load("./test/samples");
      expect(clay_index).to.not.be.null;
      expect(clay_index.models.length).to.eq(1);
    });

    it("will return a new index file if no file found", () => {
      const clay_index = clay_file.load("./test/no_file_here");
      expect(clay_index).to.not.be.null;
      expect(clay_index.models.length).to.eq(0);
    });
  });
});
