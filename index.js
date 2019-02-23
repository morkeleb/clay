#! /usr/bin/env node

var commander = require('./src/command-line');

commander.parse(process.argv);

if (!process.argv.slice(2).length) {
   commander.outputHelp();
 }
