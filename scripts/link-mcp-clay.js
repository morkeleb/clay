#!/usr/bin/env node
/**
 * Point mcp/node_modules/clay-generator at this repo.
 *
 * `npm install` inside mcp/ treats that link as an extraneous package and
 * removes it. The MCP server imports clay-generator by name, so the link has
 * to exist again before the publish build's tests start.
 */

const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const linkPath = path.join(repoRoot, 'mcp', 'node_modules', 'clay-generator');

function pointsAtRepo(target) {
  try {
    return fs.realpathSync(target) === fs.realpathSync(repoRoot);
  } catch {
    return false;
  }
}

function linkMcpClay() {
  fs.mkdirSync(path.dirname(linkPath), { recursive: true });

  let stat = null;
  try {
    stat = fs.lstatSync(linkPath);
  } catch {
    stat = null;
  }

  if (stat && !(stat.isSymbolicLink() && pointsAtRepo(linkPath))) {
    fs.rmSync(linkPath, { recursive: true, force: true });
    stat = null;
  }

  if (!stat) {
    fs.symlinkSync(repoRoot, linkPath, 'dir');
    console.log('linked mcp/node_modules/clay-generator');
  }
}

module.exports = { linkMcpClay };

if (require.main === module) {
  linkMcpClay();
}
