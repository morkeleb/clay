import path from 'path';
import { expect } from 'chai';
import fs from 'fs-extra';
import sinon from 'sinon';
import * as clay_file from '../src/clay_file';
import * as output from '../src/output';

const clayFilePath = path.resolve('.clay');

describe('clay_file', () => {
  let outputWriteStub: sinon.SinonStub;

  beforeEach(() => {
    outputWriteStub = sinon.stub(output, 'write');
  });

  afterEach(() => {
    outputWriteStub.restore();
    if (fs.existsSync(clayFilePath)) {
      fs.unlinkSync(clayFilePath);
    }
  });

  describe('createClayFile', () => {
    it('should create a .clay file with the correct structure and log output', () => {
      clay_file.createClayFile('.');
      const fileExists = fs.existsSync(clayFilePath);
      const fileContent = JSON.parse(fs.readFileSync(clayFilePath, 'utf8'));

      expect(fileExists).to.be.true;
      expect(fileContent).to.deep.equal({ models: [] });
      expect(
        outputWriteStub.calledWith('.clay file has been created successfully.')
      ).to.be.true;
    });

    it('should throw an error if a .clay file already exists', () => {
      fs.writeFileSync(clayFilePath, '', 'utf8');

      expect(() => clay_file.createClayFile('.')).to.throw(
        'A .clay file already exists in this folder.'
      );
      expect(outputWriteStub.notCalled).to.be.true;
    });
  });

  describe('models management', () => {
    it('keeps track of all models generated and which params used', () => {
      const clay_index = clay_file.load('./test/samples');
      const fileMd5 = '32453245345';
      clay_index
        .getModelIndex('./test/include-example.json', './tmp/test-output/')
        .setFileCheckSum('order.txt', fileMd5);
      expect(clay_index.models[1]).to.include({
        output: './tmp/test-output/',
        path: './test/include-example.json',
      });
    });

    it('keeps track of which files have been generated for the model', () => {
      const clay_index = clay_file.load('./test/samples');
      const fileMd5 = '32453245345';
      clay_index
        .getModelIndex('./test/include-example.json', './tmp/test-output/')
        .setFileCheckSum('order.txt', fileMd5);
      expect(clay_index.models[1].generated_files['order.txt']).to.include({
        md5: fileMd5,
      });
    });

    it('keeps the md5 checksum of the file content last generated for each file', () => {
      const clay_index = clay_file.load('./test/samples');
      const fileMd5 = '32453245345';
      clay_index
        .getModelIndex('./test/include-example.json', './tmp/test-output/')
        .setFileCheckSum('order.txt', fileMd5);

      const resultMd5 = clay_index
        .getModelIndex('./test/include-example.json', './tmp/test-output/')
        .getFileCheckSum('order.txt');

      expect(resultMd5).to.equal(fileMd5);
    });
  });

  describe('loading the generated file', () => {
    it('will check for a .clay file in the specified directory', () => {
      const clay_index = clay_file.load('./test/samples');
      expect(clay_index).to.not.be.null;
      expect(clay_index.models.length).to.eq(1);
    });

    it('will return a new index file if no file found', () => {
      const clay_index = clay_file.load('./test/no_file_here');
      expect(clay_index).to.not.be.null;
      expect(clay_index.models.length).to.eq(0);
    });
  });
});
