const tmp = require('tmp');
const fs = require('fs/promises');
const { constants } = require('fs');

tmp.setGracefulCleanup();

function makeTempFile(opts) {
  return new Promise((fulfill, reject) => {
    tmp.file(opts, (err, p) => {
      if (err) {
        reject(err);
        return;
      }

      fulfill(p);
    });
  });
}

function fileExists(filePath) {
  return new Promise((fulfill) => {
    fs.access(filePath, constants.F_OK)
      .then(() => fulfill(true))
      .catch(() => fulfill(false));
  });
}

module.exports = {
  makeTempFile,
  fileExists,
};
