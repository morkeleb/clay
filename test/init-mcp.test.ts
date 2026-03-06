import { expect } from 'chai';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';

describe('init-mcp', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'clay-init-mcp-'));
  });

  afterEach(() => {
    fs.removeSync(tmpDir);
  });

  async function getModule() {
    return await import('../src/init-mcp');
  }

  describe('detectPlatforms', () => {
    it('detects VS Code when .vscode/ exists', async () => {
      const { detectPlatforms } = await getModule();
      fs.mkdirSync(path.join(tmpDir, '.vscode'), { recursive: true });

      const platforms = detectPlatforms(tmpDir);
      expect(platforms).to.include('vscode');
    });

    it('detects Claude Code when .claude/ exists', async () => {
      const { detectPlatforms } = await getModule();
      fs.mkdirSync(path.join(tmpDir, '.claude'), { recursive: true });

      const platforms = detectPlatforms(tmpDir);
      expect(platforms).to.include('claude-code');
    });

    it('detects Cursor when .cursor/ exists', async () => {
      const { detectPlatforms } = await getModule();
      fs.mkdirSync(path.join(tmpDir, '.cursor'), { recursive: true });

      const platforms = detectPlatforms(tmpDir);
      expect(platforms).to.include('cursor');
    });

    it('returns empty array when no platforms detected', async () => {
      const { detectPlatforms } = await getModule();
      const platforms = detectPlatforms(tmpDir);
      expect(platforms).to.be.an('array').with.length(0);
    });

    it('detects multiple platforms', async () => {
      const { detectPlatforms } = await getModule();
      fs.mkdirSync(path.join(tmpDir, '.vscode'), { recursive: true });
      fs.mkdirSync(path.join(tmpDir, '.claude'), { recursive: true });

      const platforms = detectPlatforms(tmpDir);
      expect(platforms).to.include('vscode');
      expect(platforms).to.include('claude-code');
    });
  });

  describe('getConfigForPlatform', () => {
    it('returns .vscode/mcp.json with servers key for vscode', async () => {
      const { getConfigForPlatform } = await getModule();
      const config = getConfigForPlatform('vscode', tmpDir);

      expect(config.configPath).to.equal(
        path.join(tmpDir, '.vscode', 'mcp.json')
      );
      expect(config.serversKey).to.equal('servers');
    });

    it('returns .mcp.json with mcpServers key for claude-code', async () => {
      const { getConfigForPlatform } = await getModule();
      const config = getConfigForPlatform('claude-code', tmpDir);

      expect(config.configPath).to.equal(path.join(tmpDir, '.mcp.json'));
      expect(config.serversKey).to.equal('mcpServers');
    });

    it('returns .cursor/mcp.json with mcpServers key for cursor', async () => {
      const { getConfigForPlatform } = await getModule();
      const config = getConfigForPlatform('cursor', tmpDir);

      expect(config.configPath).to.equal(
        path.join(tmpDir, '.cursor', 'mcp.json')
      );
      expect(config.serversKey).to.equal('mcpServers');
    });

    it('returns claude desktop config path for claude-desktop', async () => {
      const { getConfigForPlatform } = await getModule();
      const config = getConfigForPlatform('claude-desktop', tmpDir);

      expect(config.serversKey).to.equal('mcpServers');
      // Path is OS-dependent, just check it's set
      expect(config.configPath).to.be.a('string');
    });
  });

  describe('initMcpForPlatform', () => {
    it('creates VS Code config with servers key', async () => {
      const { initMcpForPlatform } = await getModule();
      initMcpForPlatform('vscode', tmpDir);

      const mcpPath = path.join(tmpDir, '.vscode', 'mcp.json');
      expect(fs.existsSync(mcpPath)).to.equal(true);

      const config = JSON.parse(fs.readFileSync(mcpPath, 'utf8'));
      expect(config.servers.clay).to.deep.equal({
        type: 'stdio',
        command: 'clay-mcp',
        args: [],
      });
    });

    it('creates Claude Code config with mcpServers key', async () => {
      const { initMcpForPlatform } = await getModule();
      initMcpForPlatform('claude-code', tmpDir);

      const mcpPath = path.join(tmpDir, '.mcp.json');
      expect(fs.existsSync(mcpPath)).to.equal(true);

      const config = JSON.parse(fs.readFileSync(mcpPath, 'utf8'));
      expect(config.mcpServers.clay).to.deep.equal({
        command: 'clay-mcp',
        args: [],
      });
    });

    it('creates Cursor config with mcpServers key', async () => {
      const { initMcpForPlatform } = await getModule();
      initMcpForPlatform('cursor', tmpDir);

      const mcpPath = path.join(tmpDir, '.cursor', 'mcp.json');
      expect(fs.existsSync(mcpPath)).to.equal(true);

      const config = JSON.parse(fs.readFileSync(mcpPath, 'utf8'));
      expect(config.mcpServers.clay).to.deep.equal({
        command: 'clay-mcp',
        args: [],
      });
    });

    it('merges into existing config without overwriting', async () => {
      const { initMcpForPlatform } = await getModule();
      const vscodeDir = path.join(tmpDir, '.vscode');
      fs.mkdirSync(vscodeDir, { recursive: true });
      fs.writeFileSync(
        path.join(vscodeDir, 'mcp.json'),
        JSON.stringify({
          servers: {
            other: { type: 'stdio', command: 'other-mcp', args: [] },
          },
        }),
        'utf8'
      );

      initMcpForPlatform('vscode', tmpDir);

      const config = JSON.parse(
        fs.readFileSync(path.join(vscodeDir, 'mcp.json'), 'utf8')
      );
      expect(config.servers.other.command).to.equal('other-mcp');
      expect(config.servers.clay.command).to.equal('clay-mcp');
    });

    it('does not overwrite existing clay entry if run twice', async () => {
      const { initMcpForPlatform } = await getModule();
      initMcpForPlatform('vscode', tmpDir);
      initMcpForPlatform('vscode', tmpDir);

      const config = JSON.parse(
        fs.readFileSync(
          path.join(tmpDir, '.vscode', 'mcp.json'),
          'utf8'
        )
      );
      expect(Object.keys(config.servers)).to.deep.equal(['clay']);
    });

    it('uses stdio type only for vscode platform', async () => {
      const { initMcpForPlatform } = await getModule();
      initMcpForPlatform('vscode', tmpDir);
      initMcpForPlatform('claude-code', tmpDir);

      const vscodeConfig = JSON.parse(
        fs.readFileSync(
          path.join(tmpDir, '.vscode', 'mcp.json'),
          'utf8'
        )
      );
      const claudeConfig = JSON.parse(
        fs.readFileSync(path.join(tmpDir, '.mcp.json'), 'utf8')
      );

      expect(vscodeConfig.servers.clay).to.have.property('type', 'stdio');
      expect(claudeConfig.mcpServers.clay).to.not.have.property('type');
    });
  });

  describe('PLATFORMS', () => {
    it('exports list of supported platforms', async () => {
      const { PLATFORMS } = await getModule();
      expect(PLATFORMS).to.be.an('array');
      expect(PLATFORMS.length).to.be.greaterThan(0);
      for (const p of PLATFORMS) {
        expect(p).to.have.property('id');
        expect(p).to.have.property('name');
      }
    });
  });
});
