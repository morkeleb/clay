const sinon = require("sinon");
const { expect } = require("chai");
const cmd = require("../src/command-line");

describe("index.js", () => {
  beforeEach(() => {
    sinon.replace(cmd, "parse", sinon.fake());
    sinon.replace(cmd, "outputHelp", sinon.fake());
  });
  afterEach(() => {
    sinon.restore();
  });
  it("will call the commandline functions", () => {
    process.argv = ["node", "clay"];
    require("../index");
    expect(cmd.parse.calledOnce, "parse not called").to.be.true;
    expect(cmd.outputHelp.calledOnce, "outputhelp not called").to.be.true;
  });
});
