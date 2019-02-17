const fs = require('fs');



module.exports = {
    load: (path)=>{
        var model = JSON.parse(fs.readFileSync(path, 'utf8'));
        
        return model;
    }
}