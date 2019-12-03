const { getPathAndName, resolveRecursive, setDataPath } = require("../utils/vmUtils.js");

/** @module vm/Closure */

class Closure {
    /**
     * Instantiate a new closure
     * 
     * @param {Closure|null} prev - Previous closure
     * @param {string} name - Name of the closure
     */
    constructor(prev, name) {
        /** @property {Closure} prev - The previous closure */
        this.prev = prev;

        /** @property {string} name - The closure name */
        this.name = name;

        /** @property {Object.<string, Var>} data - The closure variables */ 
        this.data = {};
    }

    /**
     * Create a new closure
     * 
     * @param {string} name
     * @returns {Closure} 
     */
    createClosure(name) {
        return new Closure(this, name);
    }

    /**
     * 
     * @param {string} varName 
     * @param {Var} value 
     */
    setVar(varName, value) {
        let [path, name] = getPathAndName(varName);
        setDataPath(this.data, path, name, value);
    }

    getVar(varName) {
        let clo = this;

        while (true) {
            let [path, name] = getPathAndName(varName);
            let res = resolveRecursive(clo.data, path.join("."), name, undefined);

            if (res !== undefined) return res;

            clo = clo.prev;
            if (clo === undefined) break;
        }

        throw new VmError("Unknown variable " + varName);
    }
}

module.exports = Closure;
