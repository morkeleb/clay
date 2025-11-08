#!/usr/bin/env node

// Store CLI detection for use in other modules
(process as any).isCLI = require.main === module;

import commander from './src/command-line';

commander.parse(process.argv);

if (!process.argv.slice(2).length) {
  commander.outputHelp();
}
