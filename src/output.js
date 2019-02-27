const isCLI = require.main === module;

module.exports = {
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
