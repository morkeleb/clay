import fs from 'fs-extra';
import path from 'path';

const SETTINGS_HOOK = {
  matcher: 'Edit|Write',
  hooks: [
    {
      type: 'command',
      command: 'clay check-generated',
    },
  ],
};

export function initClaude(projectDir: string): void {
  const claudeDir = path.join(projectDir, '.claude');
  const settingsPath = path.join(claudeDir, 'settings.json');

  // Ensure .claude directory exists
  fs.mkdirSync(claudeDir, { recursive: true });

  // Read or create settings.json, merging hooks
  let settings: Record<string, unknown> = {};
  if (fs.existsSync(settingsPath)) {
    settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
  }

  if (!settings.hooks) {
    settings.hooks = {};
  }
  const hooks = settings.hooks as Record<string, unknown[]>;

  if (!hooks.PreToolUse) {
    hooks.PreToolUse = [];
  }

  // Don't add duplicate
  const preToolUse = hooks.PreToolUse as Array<{ matcher?: string }>;
  const alreadyExists = preToolUse.some(
    (h) => h.matcher === 'Edit|Write'
  );

  if (!alreadyExists) {
    preToolUse.push(SETTINGS_HOOK);
  }

  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n');
}
