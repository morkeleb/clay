/**
 * Command-line interface tests
 * Note: Uses `any` types for test data and mocks
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

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

  before(() => {
    // Disable worker threads in tests to avoid startup overhead
    process.env.CLAY_WORKERS = '0';
  });

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
      const cmdln = (await import('../src/command-line')).default;

      const result = cmdln.parse([
        'node',
        'clay',
        'generate',
        'test/samples/cmd-example.json',
        'tmp/output',
      ]);

      // Wait for async actions to complete
      await Promise.all((result as any)._actionResults || []);

      expect(
        fs.existsSync('./tmp/output/order.txt'),
        'template file not generated'
      ).to.equal(true);
    });

    it('will throw exceptions if generator not found', async () => {
      const cmdln = (await import('../src/command-line')).default;

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
        const actionResults = (result as any)._actionResults || [];
        await actionResults[1];
        run = true;
      } catch (e) {
        // Pre-flight validation now catches unresolved generators before any
        // generation runs, failing fast with an aggregated message.
        expect(e).to.match(/not found/i);
      }
      expect(run).to.equal(false);
    });

    it('will supply the generator with a specified output if specified', async () => {
      const cmdln = (await import('../src/command-line')).default;

      const result = cmdln.parse([
        'node',
        'clay',
        'generate',
        'test/samples/cmd-example.json',
        'tmp/output',
      ]);

      const actionResults = (result as any)._actionResults || [];
      await actionResults[2];
      await sleep(1);
      expect(
        fs.existsSync('./tmp/output/otheroutput/order.txt'),
        'template file not generated'
      ).to.equal(true);
    });

    it('should fail if .clay file is missing', () => {
      try {
        execSync('node dist/index.js generate', { stdio: 'pipe' });
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
        execSync('node dist/index.js clean', { stdio: 'pipe' });
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
        // Use a valid path to an existing model file so it doesn't fail on that first
        execSync(
          'node dist/index.js test-path test/samples/cmd-example.json $',
          {
            stdio: 'pipe',
          }
        );
      } catch (error: any) {
        expect(error.message).to.match(
          /This folder has not been initiated with clay/
        );
      }
    });
  });

  describe('the init command', () => {
    it('should create a .clay file', () => {
      // Remove the .clay file created in beforeEach so we can test init
      if (fs.existsSync(clayFilePath)) {
        fs.unlinkSync(clayFilePath);
      }
      execSync('node dist/index.js init -y', { stdio: 'pipe' });
      expect(fs.existsSync(clayFilePath)).to.equal(true);
    });

    it('should fail if .clay file already exists', () => {
      fs.writeFileSync(clayFilePath, '', 'utf8');
      try {
        execSync('node dist/index.js init -y', { stdio: 'pipe' });
      } catch (error: any) {
        expect(error.message).to.match(
          /A .clay file already exists in this folder/
        );
      }
    });

    it('should create a generator.json file when initializing a generator', async () => {
      const cmdln = (await import('../src/command-line')).default;
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

  describe('the config command', () => {
    it('should set gitattributes to true', () => {
      execSync('node dist/index.js config gitattributes true', {
        stdio: 'pipe',
      });
      const data = JSON.parse(fs.readFileSync(clayFilePath, 'utf8'));
      expect(data.gitattributes).to.equal(true);
    });

    it('should set gitattributes to false', () => {
      // First enable it
      execSync('node dist/index.js config gitattributes true', {
        stdio: 'pipe',
      });
      // Then disable
      execSync('node dist/index.js config gitattributes false', {
        stdio: 'pipe',
      });
      const data = JSON.parse(fs.readFileSync(clayFilePath, 'utf8'));
      expect(data).to.not.have.property('gitattributes');
    });

    it('should fail for unknown config key', () => {
      try {
        execSync('node dist/index.js config badkey true', { stdio: 'pipe' });
        expect.fail('should have thrown');
      } catch (error: any) {
        expect(error.message).to.match(/Unknown config key/);
      }
    });

    it('should fail for invalid value', () => {
      try {
        execSync('node dist/index.js config gitattributes maybe', {
          stdio: 'pipe',
        });
        expect.fail('should have thrown');
      } catch (error: any) {
        expect(error.message).to.match(/Value must be "true" or "false"/);
      }
    });
  });
});
