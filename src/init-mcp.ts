import fs from 'fs-extra';
import path from 'path';
import os from 'os';

export type PlatformId =
  | 'vscode'
  | 'claude-code'
  | 'claude-desktop'
  | 'cursor';

export interface Platform {
  id: PlatformId;
  name: string;
}

export const PLATFORMS: Platform[] = [
  { id: 'vscode', name: 'VS Code / GitHub Copilot' },
  { id: 'claude-code', name: 'Claude Code' },
  { id: 'claude-desktop', name: 'Claude Desktop' },
  { id: 'cursor', name: 'Cursor' },
];

interface PlatformConfig {
  configPath: string;
  serversKey: 'servers' | 'mcpServers';
  includeType: boolean;
}

function getClaudeDesktopConfigPath(): string {
  switch (process.platform) {
    case 'darwin':
      return path.join(
        os.homedir(),
        'Library',
        'Application Support',
        'Claude',
        'claude_desktop_config.json'
      );
    case 'win32':
      return path.join(
        process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'),
        'Claude',
        'claude_desktop_config.json'
      );
    default:
      return path.join(
        os.homedir(),
        '.config',
        'Claude',
        'claude_desktop_config.json'
      );
  }
}

export function getConfigForPlatform(
  platform: PlatformId,
  projectDir: string
): PlatformConfig {
  switch (platform) {
    case 'vscode':
      return {
        configPath: path.join(projectDir, '.vscode', 'mcp.json'),
        serversKey: 'servers',
        includeType: true,
      };
    case 'claude-code':
      return {
        configPath: path.join(projectDir, '.mcp.json'),
        serversKey: 'mcpServers',
        includeType: false,
      };
    case 'claude-desktop':
      return {
        configPath: getClaudeDesktopConfigPath(),
        serversKey: 'mcpServers',
        includeType: false,
      };
    case 'cursor':
      return {
        configPath: path.join(projectDir, '.cursor', 'mcp.json'),
        serversKey: 'mcpServers',
        includeType: false,
      };
  }
}

export function detectPlatforms(projectDir: string): PlatformId[] {
  const detected: PlatformId[] = [];

  if (fs.existsSync(path.join(projectDir, '.vscode'))) {
    detected.push('vscode');
  }
  if (fs.existsSync(path.join(projectDir, '.claude'))) {
    detected.push('claude-code');
  }
  if (fs.existsSync(path.join(projectDir, '.cursor'))) {
    detected.push('cursor');
  }

  return detected;
}

export function initMcpForPlatform(
  platform: PlatformId,
  projectDir: string
): string {
  const { configPath, serversKey, includeType } = getConfigForPlatform(
    platform,
    projectDir
  );

  // Ensure parent directory exists
  fs.mkdirSync(path.dirname(configPath), { recursive: true });

  // Read existing config or start fresh
  let config: Record<string, unknown> = {};
  if (fs.existsSync(configPath)) {
    config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  }

  if (!config[serversKey]) {
    config[serversKey] = {};
  }

  const servers = config[serversKey] as Record<string, unknown>;

  // Don't overwrite if already present
  if (!servers.clay) {
    const serverEntry: Record<string, unknown> = {
      command: 'clay-mcp',
      args: [],
    };
    if (includeType) {
      serverEntry.type = 'stdio';
    }
    servers.clay = serverEntry;
  }

  fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
  return configPath;
}
