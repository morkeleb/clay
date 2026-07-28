#!/usr/bin/env node
/**
 * Post-build fix for Clay MCP relative imports.
 *
 * The mcp source files live under mcp/shared/ and mcp/tools/ and import
 * Clay internals from the package root at dist/src/*. When tsc compiles
 * them into mcp/dist/shared/ and mcp/dist/tools/, the relative paths
 * need an extra '../' segment. This script rewrites those paths in the
 * compiled output so both source (tsx) and published (dist) work.
 */

const fs = require('fs');
const path = require('path');

const distDir = path.join(__dirname, '..', 'mcp', 'dist');
const targetDirs = ['shared', 'tools'];
const replacements = [
  { from: "require('../../dist/src/", to: "require('../../../dist/src/" },
];

function fixFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf-8');
  let changed = false;
  for (const { from, to } of replacements) {
    if (content.includes(from)) {
      content = content.split(from).join(to);
      changed = true;
    }
  }
  if (changed) {
    fs.writeFileSync(filePath, content, 'utf-8');
    console.log('Fixed imports in', path.relative(process.cwd(), filePath));
  }
}

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath);
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      fixFile(fullPath);
    }
  }
}

for (const targetDir of targetDirs) {
  const dir = path.join(distDir, targetDir);
  if (fs.existsSync(dir)) {
    walk(dir);
  }
}
