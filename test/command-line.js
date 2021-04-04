const { expect } = require("chai");
const fs = require("fs-extra");
const decache = require("decache");

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("the command line interface", () => {
  beforeEach(() => {
    fs.removeSync(".clay");
  });
  afterEach(() => {
    fs.removeSync("./tmp");
    decache("./clay-file");
  });
  describe("the generate command", () => {
    it("will generate using a specified model", async () => {
      const cmdln = require("../src/command-line");

      const result = cmdln.parse([
        "node",
        "clay",
        "generate",
        "test/samples/cmd-example.json",
        "tmp/output",
      ]);

      await Promise.all(result._actionResults);

      expect(
        fs.existsSync("./tmp/output/order.txt"),
        "template file not generated"
      ).to.equal(true);
    });

    it("will throw exceptions if generator not found", async () => {
      const cmdln = require("../src/command-line");

      const args = [
        "node",
        "clay",
        "generate",
        "test/samples/example-unknown-generator.json",
        "tmp/output",
      ];

      const result = cmdln.parse(args);
      let run = false;
      try {
        await result._actionResults[1];
        run = true;
      } catch (e) {
        expect(e).to.match(/.*generator not found.*/g);
      }
      expect(run).to.equal(false);
    });

    it("will supply the generator with a specified output if specified", async () => {
      const cmdln = require("../src/command-line");

      const result = cmdln.parse([
        "node",
        "clay",
        "generate",
        "test/samples/cmd-example.json",
        "tmp/output",
      ]);

      await result._actionResults[2];
      await sleep(1);
      expect(
        fs.existsSync("./tmp/output/otheroutput/order.txt"),
        "template file not generated"
      ).to.equal(true);
    });
  });
});
