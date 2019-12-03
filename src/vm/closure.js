/** @typedef {import('../vm.js').Var} Var */

const { getPathAndName, resolveRecursive, setDataPath } = require("../utils/vmUtils.js");
const VmError = require("../vm/error");


/** @module vm/Closure */

class Closure {
    /**
     * Instantiate a new closure
     * 
     * @param {Closure|null} prev - Previous closure
     * @param {string} name - Name of the closure
     */
    constructor(prev, name) {
        /** @type {Closure} prev - The previous closure */
        this.prev = prev;

        /** @type {string} name - The closure name */
        this.name = name;

        /** @type {Object.<string, Var>} data - The closure variables */ 
        this.data = {};
    }

    /**
     * Create a new closure
     * 
     * @param {string} name - The name of the closure
     * @returns {Closure} - The closure created
     */
    createClosure(name) {
        return new Closure(this, name);
    }

    /**
     * Declare a variable in closure
     * 
     * @param {string} varName - THe name of the variable
     * @param {Var} value - The value of the variable
     */
    setVar(varName, value) {
        let [path, name] = getPathAndName(varName);
        setDataPath(this.data, path, name, value);
    }

    /**
     * Return the variable
     * 
     * @param {string} varName - The name of the variable
     * @returns {Var} - The variable
     */
    getVar(varName) {
        /** @type {Closure} */
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
