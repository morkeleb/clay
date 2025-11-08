import { expect } from 'chai';
import fs from 'fs-extra';
import decache from 'decache';
import { execSync } from 'child_process';
import path from 'path';
import { createClayFile } from '../src/clay_file';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('the command line interface', () => {
  const clayFilePath = path.resolve('.clay');

  beforeEach(() => {
    if (fs.existsSync(clayFilePath)) {
      fs.unlinkSync(clayFilePath);
    }
    createClayFile('.');
  });

  afterEach(() => {
    fs.removeSync('./tmp');
    decache('./clay-file');
    if (fs.existsSync(clayFilePath)) {
      fs.unlinkSync(clayFilePath);
    }
    const generatorPath = path.join('clay', 'generators');
    if (fs.existsSync(generatorPath)) {
      fs.removeSync(generatorPath);
    }
  });

  describe('the generate command', () => {
    it('will generate using a specified model', async () => {
      const cmdln = require('../src/command-line').default;

      const result = cmdln.parse([
        'node',
        'clay',
        'generate',
        'test/samples/cmd-example.json',
        'tmp/output',
      ]);

      await Promise.all(result._actionResults);

      expect(
        fs.existsSync('./tmp/output/order.txt'),
        'template file not generated'
      ).to.equal(true);
    });

    it('will throw exceptions if generator not found', async () => {
      const cmdln = require('../src/command-line').default;

      const args = [
        'node',
        'clay',
        'generate',
        'test/samples/example-unknown-generator.json',
        'tmp/output',
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

    it('will supply the generator with a specified output if specified', async () => {
      const cmdln = require('../src/command-line').default;

      const result = cmdln.parse([
        'node',
        'clay',
        'generate',
        'test/samples/cmd-example.json',
        'tmp/output',
      ]);

      await result._actionResults[2];
      await sleep(1);
      expect(
        fs.existsSync('./tmp/output/otheroutput/order.txt'),
        'template file not generated'
      ).to.equal(true);
    });

    it('should fail if .clay file is missing', () => {
      try {
        execSync('node src/command-line.js generate', { stdio: 'pipe' });
      } catch (error: any) {
        expect(error.message).to.match(
          /This folder has not been initiated with clay/
        );
      }
    });
  });

  describe('the clean command', () => {
    it('should fail if .clay file is missing', () => {
      try {
        execSync('node src/command-line.js clean', { stdio: 'pipe' });
      } catch (error: any) {
        expect(error.message).to.match(
          /This folder has not been initiated with clay/
        );
      }
    });
  });

  describe('the test command', () => {
    it('should fail if .clay file is missing', () => {
      try {
        execSync('node src/command-line.js test-path someModel somePath', {
          stdio: 'pipe',
        });
      } catch (error: any) {
        expect(error.message).to.match(
          /This folder has not been initiated with clay/
        );
      }
    });
  });

  describe('the init command', () => {
    it('should create a .clay file', () => {
      execSync('node src/command-line.js init', { stdio: 'pipe' });
      expect(fs.existsSync(clayFilePath)).to.equal(true);
    });

    it('should fail if .clay file already exists', () => {
      fs.writeFileSync(clayFilePath, '', 'utf8');
      try {
        execSync('node src/command-line.js init', { stdio: 'pipe' });
      } catch (error: any) {
        expect(error.message).to.match(
          /A .clay file already exists in this folder/
        );
      }
    });

    it('should create a generator.json file when initializing a generator', () => {
      const cmdln = require('../src/command-line').default;
      const generatorName = 'myOwnGenerator';
      const generatorPath = path.join('clay', 'generators', generatorName);
      const generatorFilePath = path.join(generatorPath, 'generator.json');

      // Programmatically invoke the commander instance
      cmdln.parse(['node', 'clay', 'init', 'generator', generatorName]);

      // Verify the directory and file were created
      expect(fs.existsSync(generatorPath)).to.equal(true);
      expect(fs.existsSync(generatorFilePath)).to.equal(true);

      // Verify the content of the generator.json file
      const generatorContent = JSON.parse(
        fs.readFileSync(generatorFilePath, 'utf8')
      );
      expect(generatorContent).to.have.property('steps').that.is.an('array');
    });
  });
});
