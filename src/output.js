const chalk = require('chalk')

module.exports = {
  move: (target, dest)=>{
    if(!process.isCLI) return;
    console.log(chalk.green('moving: '), target, chalk.green(' -> '), dest)
  },
  copy: (target, dest)=>{
    if(!process.isCLI) return;
    console.log(chalk.magenta('copying: '), target, chalk.magenta(' -> '), dest)
  },
  log: (...text)=>{
    if(!process.isCLI) return;
    if(text[0]) text[0] = chalk.yellow(text[0])
    console.log.apply(console, text)
  },
  execute: (...text)=>{
    if(!process.isCLI) return;
    text.unshift(chalk.blue('executing: '))
    console.log.apply(console, text)
  },
  write: (...filename)=>{
    if(!process.isCLI) return;
    filename.unshift(chalk.green('writing: '))
    console.log.apply(console, filename)
  },
  warn: (...text)=>{
    if(!process.isCLI) return;
    text.unshift(chalk.red('Warning! '))
    console.warn.apply(console, text)
  },
  critical: (...text)=>{
    if(!process.isCLI) return;
    text.unshift(chalk.red('CRITICAL! '))
    console.warn.apply(console, text)
    process.exit()
    
  }
}
