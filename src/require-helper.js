const os_path = require('path');
// this can be done using the decache lib
function requireNew(path) {
  const p = os_path.resolve(path);
  delete require.cache[p];
  return require(path);
}

module.exports = requireNew
