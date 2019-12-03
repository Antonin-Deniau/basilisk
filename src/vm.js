const { inspect } = require("util");
const fs = require("fs");
const path = require("path");

const ast = require("./ast.js");

const Closure = require("./vm/closure");
const Debugger = require("./vm/debugger");
const VmError = require("./vm/error");

/**
 * @typedef StackEntry - Stack line
 * @type {object}
 * @property {string} file - File of the token
 * @property {number} line - File line of the token
 * @property {Closure} closure - Closure of the token
 * @property {string} func - Function of the token
 */

/**
 * @typedef Stack - The stack of the vm
 * @type {StackEntry[]}
 */

/**
 * @typedef {object} FunctionData -A function var
 * @property {string} __token__ - Variable type.
 * @property {Closure} __closure__ - The closure of the function.
 * @property {string} __name__ - The name of the function.
 * @property {Instruction[]} __instructions__ - The instructions of the function.
 * @property {Var[]} __params__ - The parametters of the function.
 */

/**
 * @typedef {object} Var - A vm variable
 * @template T
 * @property {string} __token__ - Variable type.
 * @property {T} __content__ - The content of the variable.
 */

/**
 * @typedef {Var<any>|Var<any>[]} Instruction - An instruction
 */

class Vm {
    /**
     * Instantiate a VM
     *
     * @param {string[]} paths - Paths avaialable in the global scope.
     * @constructor
     */
    constructor(paths = []) {
        /** @type {string[]} paths - Paths avaialable in the global scope. */
        this.paths = paths;
        /** @type {Stack} - The stack of the app. */
        this.stack = [];
        /** @type {Closure} context - The current context. */
        this.context = new Closure(undefined, "__G");
    }

    /**
     * Format the error
     * 
     * @param {string} error - The error message
     * @returns {string} - The formatted error
     */
    getVmError(error) {
        /**
         * Format a stack entry
         * 
         * @param {StackEntry} e - The stack entry to format 
         * @returns {string} - The formated stackentry
         */
        let line = e => `\t${e.file}:${e.line}\t${e.closure}:${e.func}()`;
        return `Error: ${error}\n${this.stack.map(line).join("\n")}\n`;
    }

    /**
     * Encapsulate the variable content
     * 
     * @param {any} __content__ - The content to encapsulate
     * @returns {Var<any>} - The variable
     * @throws {VmError}
     */
    setType(__content__) {
        switch (typeof __content__) {
        case "number": return { __token__: "NUMBER", __content__ };
        case "string": return { __token__: "STRING", __content__ };
        case "boolean": return { __token__: "BOOLEAN", __content__ };
        case "function": return { __token__: "NATIVE", __content__ };
        case "object":
            if (Array.isArray(__content__)) {
                return {
                    __token__: "ARRAY",
                    __content__: __content__.map(this.setType),
                };
            }
        }

        throw new VmError(`Invalid type ${typeof __content__} (${inspect(__content__)})`);
    }

    /**
     * De-encapsulate vars
     * 
     * @param {Var<any>[]} vars - Return the de-encapsulated variables
     * @returns {any[]} - The variables de-encapsulated
     */
    resolveTokens(vars) {
        return vars.map(this.resolveToken);
    }

    /**
     * De-encapsulate var
     * 
     * @param {Var<any>} variable - Return the de-encapsulated variable
     * @returns {any} - The variable de-encapsulated
     */
    resolveToken(variable) {
        switch (variable.__token__) {
        case "STRING": 
        case "BOOLEAN":
        case "NATIVE":
        case "NUMBER":
        case "UNDEFINED":
            return variable.__content__;
        case "NAME":
            let res = this.context.getVar(variable.__content__);
            return this.resolveToken(res);
        case "ARRAY":
            return this.resolveTokens(variable.__content__);
        case "LAMBDA":
            return (...args) => {
                let res = this.executeFunction(variable, variable, args);
                return this.resolveToken(this.executeInstruction(res));
            };
        }

        throw new VmError(`Invalid variable type ${variable.__token__} (${inspect(variable.__content__)})`);
    }

    /**
     * Execute an instruction
     * 
     * @param {Instruction} instr - The instruction to be executed
     * @returns {Var<any>} - The variable returned
     */
    executeInstruction(instr) {
        if (Array.isArray(instr)) {
            return this.processList(instr);
        } else {
            switch (instr.__token__) {
            case "STRING": 
            case "NUMBER":
            case "ARRAY":
            case "LAMBDA":
            case "NATIVE":
            case "UNDEFINED":
                return instr;
            case "NAME":
                let a = this.context.getVar(instr.__content__);
                return this.executeInstruction(a);
            }
        }
    }

    /**
     * Execute instructions
     * 
     * @param {Instruction[]} list - The instruction list
     * @returns {Var<any>} - The variable returned
     */
    executeInstructions(list) {
        let res;

        for (const data of list) {
            res = this.executeInstruction(data);
        }

        return res;
    }

    /**
     * Execute a system call
     * 
     * @param {Instruction[]} list - The instruction list
     * @returns {Var<any>} - The variable returned
     */
    operatorSys(list) {
        let path = this.resolveTokens(list.slice(1, list.length - 1).map(this.executeInstruction));
        let args = this.resolveTokens(list[list.length - 1].map(this.executeInstruction));

        let res = path.reduce((acc, arr) => acc[arr], global).call(...args);

        return this.setType(res);
    }

    /**
     * Declare function
     * 
     * @param {Instruction[]} list - The instruction list
     * @returns {Var<any>} - The variable returned
     */
    operatorFunc(list) {
        let func;

        if (list.length < 3) throw new VmError("Wrong number of arguments in func");

        if (Array.isArray(list[1])) {
            let __params__ = list[1];
            let __instructions__ = list.slice(2, list.length);
            let __name__ = "_" + Math.random().toString(36).substr(2, 9);

            let data = { __instructions__, __params__, __name__, __closure__: this.context };
            func = { __token__: "LAMBDA", __content__: data };
        } else {
            if (list.length < 4) throw new VmError("Wrong number of arguments in func " + list[1]);

            let __params__ = list[2];
            let __instructions__ = list.slice(3, list.length);
            let __name__ = list[1].__content__;

            let data = { __instructions__, __params__, __name__, __closure__: this.context };
            func = { __token__: "LAMBDA", __content__: data };

            this.context.setVar(__name__, func);
        }

        return func;
    }

    /**
     * Test ternary
     * 
     * @param {Instruction[]} list - The instruction list
     * @returns {Var<any>} - The variable returned
     */
    operatorIf(list) {
        const condition = list[1];
        const valid = list[2];
        const invalid = list[3];

        let result = this.resolveToken(this.executeInstruction(condition));

        if (result) {
            return this.executeInstruction(valid);
        } else {
            return this.executeInstruction(invalid);
        }
    }

    /**
     * Iterate on array
     * 
     * @param {Var<any>} list - The array to itterate on
     * @returns {Iterable<Var<any>>} - The variable returned
     */
    iterateOnArray(list) {
        if (list.__token__ !== "ARRAY") throw new VmError(`${inspect(list)} is not an array`);

        let a = {
            /**
             * The iterator
             */
            [Symbol.iterator]: function* () {
                for (let item of list.__content__) {
                    yield item;
                }
            },
        };

        return a;
    }

    /**
     * Assign variable
     * 
     * @param {Instruction[]} list - The instruction list
     * @returns {Var<any>} - The variable returned
     */
    operatorLet(list) {
        const name = list[1].__content__;
        const data = list[2];

        let res = this.executeInstruction(data);

        this.context.setVar(name, res);

        return res;
    }

    /**
     * Define array
     * 
     * @param {Instruction[]} list - The instruction list
     * @returns {Var<any>} - The variable returned
     */
    operatorArray(list) {
        return this.setType(this.resolveTokens(list.slice(1, list.length)));
    }

    /**
     * Import and parse a file
     * 
     * @param {Instruction[]} list - The instruction list
     * @returns {Var<any>} - The variable returned
     */
    operatorImport(list) {
        const arg = list[1].__content__.split(".");
        const PATH = this.resolveToken(this.context.getVar("PATH"));

        if (!PATH) throw new VmError("No path available");

        for (let currPath of PATH) {
            const filePath = path.resolve(currPath, ...arg) + ".cr";

            try {
                const data = fs.readFileSync(filePath, "utf8");

                return this.executeInstructions(ast(data, filePath));
            } catch (e) {
                if (e.code === "ENOENT") continue;
                throw new VmError(e);
            }
        }

        throw new VmError("Unknow file " + arg.join("."));
    }

    callArithmetic(list) {
        let dataValues;

        const op = list[0].__content__;

        data = resolveTokens(list.slice(1, list.length).map(executeInstruction));

        const args = data.slice(1, data.length);
        const initial = data[0];

        let res;
        switch (op) {
        case "+": res = args.reduce((acc, arr) => acc + arr, initial); break;
        case "/": res = args.reduce((acc, arr) => acc / arr, initial); break;
        case "*": res = args.reduce((acc, arr) => acc * arr, initial); break;
        case "-": res = args.reduce((acc, arr) => acc - arr, initial); break;
        case "&": res = args.reduce((acc, arr) => acc & arr, initial); break;
        case "|": res = args.reduce((acc, arr) => acc & arr, initial); break;
        case "==": res = data[0] == data[1]; break;
        case "!=": res = data[0] != data[1]; break;
        case "!": res = !data[0]; break;
        default:
            throw new VmError("Undefined arithmetic" + op);
        }

        return setType(res);
    }

    executeFunction(loc, func, args) {
        if (func.__token__ !== "LAMBDA") {
            throw new VmError(`${typeof func} is not a function (${func.__token__})`);
        }

        let argsValue = [];
        while (true) {
            arg = args.shift();
            if (arg === undefined) break;

            res = executeInstruction(arg);
            argsValue.push(res);
        }

        stack.push({
            file: loc.__file__,
            line: loc.__line__,
            closure: this.context.name,
            func: func.__name__,
        });

        let backupContext = this.context;
        this.context = func.__closure__.createClosure(func.__name__);

        let index = 0;
        for (let desc of func.__params__) {
            this.context.setVar(desc.__content__, argsValue[index]);
            index++;
        }
        this.context.setVar("__arguments__", setType(resolveTokens(argsValue)));
        this.context.setVar("__name__", setType(func.__name__));

        result = executeInstructions(func.__instructions__);

        this.context = backupContext;

        stack.pop();
        return result;
    }

    callNative(list) {
        const name = list[0].__content__;
        const args = list.slice(1, list.length);

        const func = this.context.getVar(name);

        if (func.__token__ !== "NATIVE") {
            throw new VmError(`${name} is not a native function (${func.__token__})`);
        }

        return setType(func.__content__(args));
    }

    callAnonymous(list) {
        const func = list[0];
        const args = list.slice(1, list.length);

        return executeFunction(list[0], func, args);
    }

    callLambda(list) {
        const func = executeInstruction(list[0]);

        const args = list.slice(1, list.length);

        return executeFunction(list[0], func, args);
    }

    callFunction(list) {
        const name = list[0].__content__;

        const func = this.context.getVar(name);
        const args = list.slice(1, list.length);

        return executeFunction(list[0], func, args);
    }

    callOperator(list) {
        const symbol = list[0].__content__;

        switch (symbol) {
        case "import": return operatorImport(list);
        case "func": return operatorFunc(list);
        case "let": return operatorLet(list);
        case "array": return operatorArray(list);
        case "sys": return operatorSys(list);
        case "if": return operatorIf(list);
        }

        throw new VmError("Undefined operator " + list[0].__content__);
    }

    processList(list) {
        let op;
        if (Array.isArray(list[0])) {
            return callLambda(list);
        } else {
            op = list[0];
        }

        switch (op.__token__) {
        case "STRING":
        case "NUMBER":
        case "ARRAY":
            throw new VmError(`Invalid __token__ ${op.__token__} in the list (${inspect(op)})`);
        case "NAME": return callFunction(list);
        case "LAMBDA": return callAnonymous(list);
        case "OPERATOR": return callOperator(list);
        case "ARITHMETIC": return callArithmetic(list);
        case "NATIVE": return callNative(list);
        }

        throw new VmError("Undefined __token__: " + op.__token__);
    }

    /**
     * Run the ast in the VM
     * 
     * @param {Instruction[]} tokens - The ast to execute
     * @return {Var} - The result of the execution
     */
    run(tokens) {
        const corePath = path.resolve(__dirname, "..", "lib");

        this.context.setVar("PATH", [...this.paths, corePath]);

        try {
            return this.executeInstructions(tokens);
        } catch (e) {
            console.log(e.stack);
            console.log(this.getVmError(e));
            //new Debugger().start(context);
        }
    }
}

module.exports = Vm;
