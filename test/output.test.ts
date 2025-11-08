import sinon from "sinon";
import { expect } from "chai";
import * as output from "../src/output";
import chalk from "chalk";

describe("the output module", () => {
  let consoleLogStub: sinon.SinonStub;
  let consoleWarnStub: sinon.SinonStub;
  let processExitStub: sinon.SinonStub;

  before(() => {
    consoleLogStub = sinon.stub(console, "log");
    consoleWarnStub = sinon.stub(console, "warn");
    processExitStub = sinon.stub(process, "exit") as sinon.SinonStub;
    (process as any).isCLI = true;
  });

  after(() => {
    consoleLogStub.restore();
    consoleWarnStub.restore();
    processExitStub.restore();
  });

  it("will print to the log for logging", () => {
    output.log("test");
    expect(consoleLogStub.calledWithMatch("test")).to.be.true;
  });

  it("will print to the log for copy", () => {
    output.copy("t2est", "test2");
    sinon.assert.calledWith(
      consoleLogStub,
      chalk.magenta("copying: "),
      "t2est",
      chalk.magenta(" -> "),
      "test2"
    );
  });

  it("will print to the log for move", () => {
    output.move("t2es2t", "te2st2");
    sinon.assert.calledWith(
      consoleLogStub,
      chalk.green("moving: "),
      "t2es2t",
      chalk.green(" -> "),
      "te2st2"
    );
  });

  it("will print to the log for write", () => {
    output.write("te12st");
    sinon.assert.calledWith(consoleLogStub, chalk.green("writing: "), "te12st");
  });

  it("will print to the log for execute", () => {
    output.execute("tes2t");
    sinon.assert.calledWith(consoleLogStub, chalk.blue("executing: "), "tes2t");
  });

  it("will print to the stderr for warn", () => {
    output.warn("test");
    sinon.assert.calledWith(consoleWarnStub, chalk.red("Warning! "), "test");
  });

  it("will print to the stderr for critical and quit", () => {
    output.critical("test");
    sinon.assert.calledWith(consoleWarnStub, chalk.red("CRITICAL! "), "test");
    expect(processExitStub.calledOnce).to.be.true;
  });
});
