
const resolveRecursive = (object, initPath, initName, defaultValue) => {
	initName = initName.split(".");
	initPath = initPath.split(".");
	let path = [...initPath, ...initName.slice(0, initName.length - 1)].filter(e => "" !== e);
	let name = initName[initName.length - 1];

	let res;
	while (true) {
		res = resolvePath(object, [...path, name].join("."), false);
		if (res !== false) return res;

		if (path.length === 0) throw "Cannot find variable " + initPath.filter(e => "" !== e).join(".") + "." + name;
		path.shift();
	};
};

const concatPath = (a, ...b) => a === "" ? b.join(".") : [a, ...b].join(".");

const resolvePath = (object, path, defaultValue) => path
   .split('.').filter(e => e !== "")
   .reduce((o, p) => o && o[p] ? o[p] : defaultValue, object)

const setPath = (object, path, value) => path
   .split('.').filter(e => e !== "")
   .reduce((o,p,i) => o[p] = path.split('.').length === ++i ? value : o[p] || {}, object)

const setDataPath = (object, path, name, value) => setPath(object, concatPath(path, name), value);

module.exports = { setDataPath, resolveRecursive, concatPath };
