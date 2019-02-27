const isCLI = require.main === module;

module.exports = {
  move: (target, dest)=>{
    if(!isCLI) return;
    console.log('moving ', target, ' -> ', dest)
  },
  copy: (target, dest)=>{
    if(!isCLI) return;
    console.log('copying ', target, ' -> ', dest)
  },
  log: (...text)=>{
    if(!isCLI) return;
    console.log.apply(console, text)
  },
  execute: (...text)=>{
    if(!isCLI) return;
    text.unshift('executing: ')
    console.log.apply(console, text)
  },
  write: (...filename)=>{
    if(!isCLI) return;
    text.unshift('writing: ')
    console.log.apply(console, filename)
  },
  warn: (...text)=>{
    if(!isCLI) return;
    text.unshift('Warning! ')
    console.warn.apply(console, text)
  },
  critical: (text)=>{
    if(!isCLI) return;
    text.unshift('CRITICAL! ')
    console.warn.apply(console, text)
    process.exit()
    
  }
}
