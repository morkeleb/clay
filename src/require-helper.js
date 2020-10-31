const os_path = require('path');

function requireNew(path) {
  const p = os_path.resolve(path);
  delete require.cache[p];
  return require(path);
}

module.exports = requireNew
