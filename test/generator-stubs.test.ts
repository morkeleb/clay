import { expect } from 'chai';
import { stubForEngine } from '../src/generator-stubs';

describe('generator engine stubs', () => {
  it('handlebars stub uses handlebars syntax and clay_key', () => {
    const s = stubForEngine('handlebars');
    expect(s).to.be.a('string').and.have.length.greaterThan(0);
    expect(s).to.include('{{clay_key}}');
  });

  it('ejs stub uses ejs syntax and clay_key', () => {
    const s = stubForEngine('ejs');
    expect(s).to.include('<%= clay_key %>');
  });

  it('ts stub exports a default class extending CodeGenerator with render()', () => {
    const s = stubForEngine('ts');
    expect(s).to.include("from 'clay-generator/types'");
    expect(s).to.include('export default class');
    expect(s).to.include('extends CodeGenerator');
    expect(s).to.match(/render\s*\(/);
  });
});
