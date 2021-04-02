const path = require("path");
const { expect } = require("chai");
const clay_file = require("../src/clay_file.js");

describe("the clay file index system", () => {
  describe("the models portion", () => {
    it("keeps track of all models generatored and which params used", () => {});
    it("keeps track of which files have been generated for the model", () => {});
    it("keeps the md5 checksum of the filecontent last generated for each file", () => {});
  });
  describe("loading the generated file", () => {
    it("will check for a .clay file in the specified directory", () => {
      const clay_index = clay_file("./samples");
      expect(clay_index).to.not.be.null;
      expect(clay_index.models.length).to.eq(1);
    });
  });
});
