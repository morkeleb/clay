#! /usr/bin/env node

process.isCLI = require.main === module;

var commander = require('./src/command-line');

commander.parse(process.argv);

if (!process.argv.slice(2).length) {
   commander.outputHelp();
 }
