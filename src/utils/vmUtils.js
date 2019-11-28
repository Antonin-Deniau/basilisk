const getPathAndName = part => {
    const fullPath = part.split(".").filter(e => "" !== e);

    return [
        fullPath.slice(0, fullPath.length - 1),
        fullPath[fullPath.length - 1],
    ];
};

const resolveRecursive = (object, initPath, initName, defaultValue) => {
    initName = initName.split(".");
    initPath = initPath.split(".");
    let path = [...initPath, ...initName.slice(0, initName.length - 1)].filter(e => "" !== e);
    let name = initName[initName.length - 1];

    let res;
    while (true) {
        let testPath = [...path, name].join(".");
        res = resolvePath(object, testPath, undefined);
        if (res !== undefined) return res;

        if (path.length === 0) return undefined;
        path.shift();
    }
};


const concatPath = (a, ...b) => a === "" ? b.join(".") : [a, ...b].join(".");

const resolvePath = (object, path, defaultValue) => path
    .split(".").filter(e => e !== "")
    .reduce((o, p) => o && o.hasOwnProperty(p) ? o[p] : defaultValue, object);


const setPath = (obj, propertyPath, value) => {
    let properties = Array.isArray(propertyPath) ? propertyPath : propertyPath.split(".").filter(e => e !== "");

    if (properties.length > 1) {
        if (!obj.hasOwnProperty(properties[0]) || typeof obj[properties[0]] !== "object") obj[properties[0]] = {};
        return setPath(obj[properties[0]], properties.slice(1), value);
    } else {
        obj[properties[0]] = value;
        return true;
    }

};

const setDataPath = (object, path, name, value) => setPath(object, concatPath(path, name), value);

module.exports = { setDataPath, resolveRecursive, getPathAndName };
