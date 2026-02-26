const fs = require('fs');

module.exports.readVersion = function (contents) {
  const match = contents.match(/version = "(.+?)"/);
  return match ? match[1] : null;
};

module.exports.writeVersion = function (contents, version) {
  return contents.replace(
    /version = ".+?"/,
    `version = "${version}"`
  );
};
