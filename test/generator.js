const generator = require("../src/generator");
const { expect } = require("chai");
const sinon = require("sinon");
const output = require("../src/output");

const model = require("../src/model");
const fs = require("fs-extra");
const path = require("path");
var mock = require("mock-require");

describe("a generator", () => {
  afterEach(() => {
    fs.removeSync("./tmp");
  });
  describe("basic initialization", () => {
    it("will read a json array with instructions", () => {
      var result = generator.load("./test/samples/generator.json");
      expect(result.steps).to.deep.equal([
        {
          runCommand: "jhipster microservice",
        },
        {
          generate: "templates/jdl-files",
          select: "$.jsonpath.statement", // Updated to valid JSONPath
        },
        {
          runCommand: "jhipster import-jdl {{service.name}}",
          select: "$.jsonpath.statement", // Updated to valid JSONPath
        },
        {
          copy: "git+morkeleb/foundation",
          select: "$.jsonpath.statement", // Updated to valid JSONPath
          target: "{{microservice}}",
        },
      ]);
    });
  });
  describe("jsonpath selection error handling", () => {
    afterEach(() => {
      output.warn.restore();
      output.critical.restore();
    });
    beforeEach(() => {
      sinon.stub(output, "warn");

      sinon.stub(output, "critical");
    });
    it("will warn if no selection is found", async () => {
      const modelIndex = require("../src/clay_file")
        .load("./test/samples")
        .getModelIndex("./test/include-example.json", "./tmp/test-output/");
      var g = generator.load(
        "./test/samples/just-copy-example.json",
        "",
        modelIndex
      );
      g.steps[0].select = "$.valid.jsonpath"; // Updated to valid JSONPath
      await g.generate(
        model.load("./test/samples/example-unknown-generator.json"),
        "./tmp/test-output"
      );

      expect(
        output.warn.calledWith(
          "No entires found for jsonpath ",
          g.steps[0].select
        )
      ).to.be.true;
    });
    it("will warn and stop if jsonpath expression is bad", async () => {
      const modelIndex = require("../src/clay_file")
        .load("./test/samples")
        .getModelIndex("./test/include-example.json", "./tmp/test-output/");
      var g = generator.load(
        "./test/samples/just-copy-example.json",
        "",
        modelIndex
      );
      g.steps[0].select = "I will so crash!"; // Invalid JSONPath retained for testing
      await g.generate(
        model.load("./test/samples/example-unknown-generator.json"),
        "./tmp/test-output"
      );

      expect(output.critical.calledOnce).to.be.true;
    });
  });
  describe("generate with template", () => {
    describe("formatters", () => {
      let formatter_fake = null;
      afterEach(() => {
        delete require.cache["clay-generator-formatter-prettify"];
        mock.stop("resolve-global");
      });
      beforeEach(() => {
        mock("resolve-global", (x) => x);

        formatter_fake = sinon.fake((filename, data, step, options) => {
          if (step && step.generate) {
            expect(step).to.have.property("generate");
          }
          if (options && options.semi !== undefined) {
            expect(options).to.have.property("semi", false);
            expect(options).to.have.property("singleQuote", true);
          }
        });
        mock("clay-generator-formatter-prettify", {
          extensions: ["**/*.js", "**/*.jsx"],
          apply: (filename, data, step, options) => {
            formatter_fake(filename, data, step, options);
            return data;
          },
        });
      });
      it("will apply the formatters where the extensions match", async () => {
        const m = model.load("./test/samples/include-example.json");

        const modelIndex = require("../src/clay_file")
          .load("./test/samples")
          .getModelIndex("./test/include-example.json", "./tmp/test-output/");
        var g = generator.load(
          "./test/samples/formatter-example.json",
          "",
          modelIndex
        );

        g.formatters = [
          {
            package: "clay-generator-formatter-prettify",
            options: { semi: false, singleQuote: true },
          },
        ];

        const step = {
          generate: "templates/java{{name}}.js",
          select: "$.model.types.*",
          target: "/",
        };
        g.steps = [step];

        await g.generate(m, "./tmp/test-output");
        sinon.assert.calledWith(
          formatter_fake,
          "tmp/test-output/javaorder.js",
          "content of javascript file\n",
          { semi: false, singleQuote: true }
        );
      });
      it("wont apply the formatters where the extensions dont match", async () => {
        const m = model.load("./test/samples/include-example.json");
        const modelIndex = require("../src/clay_file")
          .load("./test/samples")
          .getModelIndex("./test/include-example.json", "./tmp/test-output/");

        var g = generator.load(
          "./test/samples/formatter-example.json",
          "",
          modelIndex
        );

        await g.generate(m, "./tmp/test-output");
        sinon.assert.neverCalledWith(
          formatter_fake,
          "content of just file txt\n"
        );
      });
    });
    describe("formatters with configuration", () => {
      let formatter_fake = null;
      afterEach(() => {
        delete require.cache["clay-generator-formatter-prettify"];
        mock.stop("resolve-global");
      });
      beforeEach(() => {
        mock("resolve-global", (x) => x);

        formatter_fake = sinon.fake((filename, data, step, options) => {
          if (step && step.generate) {
            expect(step).to.have.property("generate");
          }
          if (options && options.semi !== undefined) {
            expect(options).to.have.property("semi", false);
            expect(options).to.have.property("singleQuote", true);
          }
        });
        mock("clay-generator-formatter-prettify", {
          extensions: ["**/*.js", "**/*.jsx"],
          apply: (filename, data, options) => {
            formatter_fake(filename, data, options);
            return data;
          },
        });
      });
      it("will apply the formatters with the provided configuration", async () => {
        const m = model.load("./test/samples/include-example.json");

        const modelIndex = require("../src/clay_file")
          .load("./test/samples")
          .getModelIndex("./test/include-example.json", "./tmp/test-output/");
        var g = generator.load(
          "./test/samples/formatter-example.json",
          "",
          modelIndex
        );

        g.formatters = [
          {
            package: "clay-generator-formatter-prettify",
            options: { semi: false, singleQuote: true },
          },
        ];

        const step = {
          generate: "templates/java{{name}}.js",
          select: "$.model.types.*",
          target: "/",
        };
        g.steps = [step];

        await g.generate(m, "./tmp/test-output");
        sinon.assert.calledWith(
          formatter_fake,
          "tmp/test-output/javaorder.js",
          "content of javascript file\n",
          { semi: false, singleQuote: true }
        );
      });
    });
    describe("formatters with step parameter", () => {
      let formatter_fake = null;
      afterEach(() => {
        delete require.cache["clay-generator-formatter-prettify"];
        mock.stop("resolve-global");
      });
      beforeEach(() => {
        mock("resolve-global", (x) => x);

        formatter_fake = sinon.fake((filename, data, step, options) => {
          if (step && step.generate) {
            expect(step).to.have.property("generate");
          }
          if (options && options.semi !== undefined) {
            expect(options).to.have.property("semi", false);
            expect(options).to.have.property("singleQuote", true);
          }
        });
        mock("clay-generator-formatter-prettify", {
          extensions: ["**/*.js", "**/*.jsx"],
          apply: (filename, data, step, options) => {
            formatter_fake(filename, data, step, options);
            return data;
          },
        });
      });
      it("will apply the formatters with the step parameter", async () => {
        const m = model.load("./test/samples/include-example.json");

        const modelIndex = require("../src/clay_file")
          .load("./test/samples")
          .getModelIndex("./test/include-example.json", "./tmp/test-output/");
        var g = generator.load(
          "./test/samples/formatter-example.json",
          "",
          modelIndex
        );

        g.formatters = [
          {
            package: "clay-generator-formatter-prettify",
            options: { semi: false, singleQuote: true },
          },
        ];

        const step = {
          generate: "templates/java{{name}}.js",
          select: "$.model.types.*",
          target: "/",
        };
        g.steps = [step];

        await g.generate(m, "./tmp/test-output");
        sinon.assert.calledWithMatch(
          formatter_fake,
          "tmp/test-output/javaorder.js",
          "content of javascript file\n",
          sinon.match({ semi: false, singleQuote: true }),
          sinon.match({
            generate: "templates/java{{name}}.js",
            select: "$.model.types.*",
            target: "/",
          })
        );
      });
    });
    describe("with jsonpath statement", () => {
      it("will generate the templates using jsonpath selection", async () => {
        const modelIndex = require("../src/clay_file")
          .load("./test/samples")
          .getModelIndex("./test/include-example.json", "./tmp/test-output/");
        var g = generator.load(
          "./test/samples/just-template-example.json",
          "",
          modelIndex
        );
        await g.generate(
          model.load("./test/samples/example-unknown-generator.json"),
          "./tmp/test-output"
        );

        expect(
          fs.existsSync("./tmp/test-output/order.txt"),
          "template file not generated"
        ).to.equal(true);
      });
      it("context for handlebars is decorated with parents", async () => {
        const modelIndex = require("../src/clay_file")
          .load("./test/samples")
          .getModelIndex("./test/include-example.json", "./tmp/test-output/");
        var g = generator.load(
          "./test/samples/just-template-example.json",
          "",
          modelIndex
        );
        await g.generate(
          model.load("./test/samples/example-unknown-generator.json"),
          "./tmp/test-output"
        );

        expect(
          fs.existsSync(
            "./tmp/test-output/complex/finish_order/commands/finish_order.tx"
          ),
          "template file not generated"
        ).to.equal(true);

        var result = fs.readFileSync(
          "./tmp/test-output/complex/finish_order/commands/finish_order.tx",
          "utf8"
        );

        expect(result).to.equal(
          "finish_order\n$.model.types[0]\norder\n$.model\n2\n$\nmymodel\n"
        );
      });
      it("will respect subdirectories", async () => {
        const modelIndex = require("../src/clay_file")
          .load("./test/samples")
          .getModelIndex("./test/include-example.json", "./tmp/test-output/");

        var g = generator.load(
          "./test/samples/just-template-example.json",
          "",
          modelIndex
        );

        await g.generate(
          model.load("./test/samples/example-unknown-generator.json"),
          "./tmp/test-output"
        );

        expect(
          fs.existsSync("./tmp/test-output/types/order.tx"),
          "template file not generated"
        ).to.equal(true);
      });
      it("will respect targets with templating", async () => {
        const modelIndex = require("../src/clay_file")
          .load("./test/samples")
          .getModelIndex("./test/include-example.json", "./tmp/test-output/");
        var g = generator.load(
          "./test/samples/just-template-example.json",
          "",
          modelIndex
        );
        await g.generate(
          model.load("./test/samples/example-unknown-generator.json"),
          "./tmp/test-output"
        );

        expect(
          fs.existsSync("./tmp/test-output/t1/order/order.txt"),
          "template file not generated"
        ).to.equal(true);
      });

      it("if target is just a single file, it will just template that file", async () => {
        const modelIndex = require("../src/clay_file")
          .load("./test/samples")
          .getModelIndex("./test/include-example.json", "./tmp/test-output/");
        var g = generator.load(
          "./test/samples/just-template-example.json",
          "",
          modelIndex
        );
        await g.generate(
          model.load("./test/samples/example-unknown-generator.json"),
          "./tmp/test-output"
        );

        expect(
          fs.existsSync("./tmp/test-output/justfileorder.txt"),
          "template file not generated"
        ).to.equal(true);
      });
    });

    describe("partials", () => {
      it("will use generator partials", async () => {
        const modelIndex = require("../src/clay_file")
          .load("./test/samples")
          .getModelIndex("./test/include-example.json", "./tmp/test-output/");
        var g = generator.load(
          "./test/samples/just-template-example.json",
          "",
          modelIndex
        );
        await g.generate(
          model.load("./test/samples/example-unknown-generator.json"),
          "./tmp/test-output"
        );
        var result = fs.readFileSync("./tmp/test-output/order.txt", "utf8");

        expect(result).to.equal("hello\norder");
      });
    });

    describe("without jsonpath statement", () => {
      //todo: this isn't a thing right?
    });
  });
  describe("run command", () => {
    describe("with jsonpath statement", () => {
      it("will run the command for each result from jsonpath", async () => {
        var g = generator.load("./test/samples/just-command-example.json");
        const modelIndex = require("../src/clay_file")
          .load("./test/samples")
          .getModelIndex("./test/include-example.json", "./tmp/test-output/");

        await g.generate(
          model.load("./test/samples/example-unknown-generator.json"),
          "./tmp/test-output"
        );

        expect(
          fs.existsSync("./tmp/test-output/order"),
          "command not run for order"
        ).to.equal(true);
        expect(
          fs.existsSync("./tmp/test-output/product"),
          "command not run for product"
        ).to.equal(true);
      });
    });

    describe("without jsonpath statement", () => {
      it("will run the command once", async () => {
        var g = generator.load("./test/samples/just-command-example.json");
        const modelIndex = require("../src/clay_file")
          .load("./test/samples")
          .getModelIndex("./test/include-example.json", "./tmp/test-output/");

        await g.generate(
          model.load("./test/samples/example-unknown-generator.json"),
          "./tmp/test-output"
        );

        expect(
          fs.existsSync("./tmp/test-output/once"),
          "template file not generated"
        ).to.equal(true);
      });
    });
  });
  describe("copy foundation", () => {
    describe("with jsonpath statement", () => {
      it("will copy to a templated path with input from jsonpath", async () => {
        const modelIndex = require("../src/clay_file")
          .load("./test/samples")
          .getModelIndex("./test/include-example.json", "./tmp/test-output/");
        var g = generator.load(
          "./test/samples/just-copy-example.json",
          "",
          modelIndex
        );

        await g.generate(
          model.load("./test/samples/example-unknown-generator.json"),
          "./tmp/test-output"
        );

        expect(
          fs.existsSync("./tmp/test-output/copies/product/product/product/hi"),
          "file not copied"
        ).to.equal(true);
        expect(
          fs.existsSync("./tmp/test-output/copies/order/order/order/hi"),
          "file not copied"
        ).to.equal(true);
        expect(
          fs.existsSync("./tmp/test-output/order/hi"),
          "file not copied"
        ).to.equal(true);
      });
    });

    describe("without jsonpath statement", () => {
      it("will copy once", async () => {
        const modelIndex = require("../src/clay_file")
          .load("./test/samples")
          .getModelIndex("./test/include-example.json", "./tmp/test-output/");
        var g = generator.load(
          "./test/samples/just-copy-example.json",
          "",
          modelIndex
        );

        await g.generate(
          model.load("./test/samples/example-unknown-generator.json"),
          "./tmp/test-output"
        );

        expect(
          fs.existsSync("./tmp/test-output/once"),
          "file not copied"
        ).to.equal(true);
      });
      it("will copy overwrite existing files", async () => {
        const modelIndex = require("../src/clay_file")
          .load("./test/samples")
          .getModelIndex("./test/include-example.json", "./tmp/test-output/");
        var g = generator.load(
          "./test/samples/just-copy-example.json",
          "",
          modelIndex
        );
        fs.ensureDirSync(path.resolve("./tmp/test-output/"));
        fs.writeFileSync(path.resolve("./tmp/test-output/once"), "hi!");

        await g.generate(
          model.load("./test/samples/example-unknown-generator.json"),
          "./tmp/test-output"
        );

        expect(
          fs.readFileSync("./tmp/test-output/once", "utf8"),
          "file not copied"
        ).to.equal("once");
      });
      it("will copy directories", async () => {
        const modelIndex = require("../src/clay_file")
          .load("./test/samples")
          .getModelIndex("./test/include-example.json", "./tmp/test-output/");

        var g = generator.load(
          "./test/samples/just-copy-example.json",
          "",
          modelIndex
        );

        await g.generate(
          model.load("./test/samples/example-unknown-generator.json"),
          "./tmp/test-output"
        );

        expect(
          fs.existsSync("./tmp/test-output/level1/static"),
          "file not copied"
        ).to.equal(true);
      });
    });
  });
  describe("cleaning up", () => {
    describe("the templates", () => {
      it("will remove files", async () => {
        const modelIndex = require("../src/clay_file")
          .load("./test/samples")
          .getModelIndex("./test/include-example.json", "./tmp/test-output/");

        var g = generator.load(
          "./test/samples/just-template-example.json",
          "",
          modelIndex
        );
        await g.generate(
          model.load("./test/samples/example-unknown-generator.json"),
          "./tmp/test-output"
        );
        g.clean(
          model.load("./test/samples/example-unknown-generator.json"),
          "./tmp/test-output"
        );
        expect(
          fs.existsSync("./tmp/test-output/order.txt"),
          "generated file not removed"
        ).to.equal(false);
      });
    });
    describe("the copies", () => {
      describe("a single file copy", () => {
        it("will remove the file", async () => {
          const modelIndex = require("../src/clay_file")
            .load("./test/samples")
            .getModelIndex("./test/include-example.json", "./tmp/test-output/");

          var g = generator.load(
            "./test/samples/just-copy-example.json",
            "",
            modelIndex
          );

          await g.generate(
            model.load("./test/samples/example-unknown-generator.json"),
            "./tmp/test-output"
          );
          g.clean(
            model.load("./test/samples/example-unknown-generator.json"),
            "./tmp/test-output"
          );

          expect(
            fs.existsSync("./tmp/test-output/once"),
            "file not removed"
          ).to.equal(false);
        });
      });
      describe("a directory copy", () => {
        it("will remove the directory", async () => {
          const modelIndex = require("../src/clay_file")
            .load("./test/samples")
            .getModelIndex("./test/include-example.json", "./tmp/test-output/");

          var g = generator.load(
            "./test/samples/just-copy-example.json",
            "",
            modelIndex
          );

          await g.generate(
            model.load("./test/samples/example-unknown-generator.json"),
            "./tmp/test-output"
          );
          g.clean(
            model.load("./test/samples/example-unknown-generator.json"),
            "./tmp/test-output"
          );

          expect(
            fs.existsSync("./tmp/test-output/level1/static"),
            "directory not removed"
          ).to.equal(false);
        });
      });
    });
  });
  describe("schema validation", () => {
    let warnSpy;

    beforeEach(() => {
      warnSpy = sinon.spy(output, "warn");
    });

    afterEach(() => {
      warnSpy.restore();
    });

    it("should throw an error for an invalid generator schema and log warnings", () => {
      expect(() => {
        generator.load("./test/samples/broken-generator.json");
      }).to.throw(Error, /Invalid generator schema/);

      sinon.assert.calledWithMatch(
        warnSpy,
        sinon.match(/Error in path 'steps.1.select'/)
      );
      sinon.assert.calledWithMatch(
        warnSpy,
        sinon.match(/Error in path 'steps.2.select'/)
      );
      sinon.assert.calledWithMatch(
        warnSpy,
        sinon.match(/Error in path 'steps.3.select'/)
      );
    });
  });
});
