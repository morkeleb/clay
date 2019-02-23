const fs = require('fs');
const path = require('path')

function executeMixins(model) {
  const mixins = model.mixins.reduce(function(map, obj) {
    map[obj.name] = eval(obj.function);
    return map;
  }, {});
  const check = m => {
    if(m.hasOwnProperty('mixin')) {
      
      m.mixin.forEach(mixin_key => {
        mixins[mixin_key](m)
      });
      delete m.mixin
    }
    
    if(Array.isArray(m)){
      for (let index = 0; index < m.length; index++) {
        const element = m[index];
        
        if(typeof element === 'object') {
          check(element);
        }
      }
      return;
    }
    for (const property in m) {
      if (m.hasOwnProperty(property)) {
        const e = m[property];
        
        if(typeof e === 'object') {
          check(e)
        }
      }
    }
  }
  for (const modelproperty in model.model) {
    if (model.model.hasOwnProperty(modelproperty)) {
      const element = model.model[modelproperty];
      
      check(element)
    }
  }
}

function executeIncludes(model, p) {
  const check = m => {
    if(m.hasOwnProperty('include')) {
      const include_path = path.join(path.dirname(p), m.include)
      var include = JSON.parse(fs.readFileSync(include_path,'utf8'))
      for (const key in include) {
        if (include.hasOwnProperty(key)) {
          m[key] = include[key];
        }
      }
      delete m.include
    }
    
    if(Array.isArray(m)){
      for (let index = 0; index < m.length; index++) {
        const element = m[index];
        
        if(typeof element === 'object') {
          check(element);
        }
      }
      return;
    }
    for (const property in m) {
      if (m.hasOwnProperty(property)) {
        const e = m[property];
        
        if(typeof e === 'object') {
          check(e)
        }
      }
    }
  }
  for (const modelproperty in model.model) {
    if (model.model.hasOwnProperty(modelproperty)) {
      const element = model.model[modelproperty];
      
      check(element)
    }
  }
}


module.exports = {
  load: (path)=>{
    var model = JSON.parse(fs.readFileSync(path, 'utf8'));
    executeIncludes(model, path);
    executeMixins(model);
    
    return model;
  }
}
