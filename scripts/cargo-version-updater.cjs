module.exports.readVersion = (contents) => {
	const match = contents.match(/version = "(.+?)"/);
	return match ? match[1] : null;
};

module.exports.writeVersion = (contents, version) =>
	contents.replace(/version = ".+?"/, `version = "${version}"`);
