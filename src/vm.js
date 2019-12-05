const { inspect } = require("util");
const fs = require("fs");
const path = require("path");
const autoBind = require("auto-bind");

const ast = require("./ast.js");

const Closure = require("./vm/closure");

/**
 * @typedef StackEntry - Stack line
 * @type {object}
 * @property {string} file - File of the token
 * @property {number} line - File line of the token
 * @property {string} closure - Closure of the token
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
 * @property {Var<any>[]} __params__ - The parametters of the function.
 */

/**
 * @template T
 * @typedef {object} Var - A vm variable
 * @property {string} __token__ - Variable type.
 * @property {string} [__file__] - File location.
 * @property {number} [__line__] - Line location.
 * @property {string} __token__ - Variable type.
 * @property {T} __content__ - The content of the variable.
 */

/**
 * @typedef {Var<any>|any[]} Instruction - An instruction
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

        autoBind(this);
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
        case "function": 
            return { __token__: "NATIVE", __content__ };
        case "object":
            if (Array.isArray(__content__)) {
                return {
                    __token__: "ARRAY",
                    __content__: __content__.map(this.setType),
                };
            }
        case "undefined": return { __token__: "NULL", __content__: null };
        }

        throw `Invalid type ${typeof __content__} (${inspect(__content__)})`;
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
        case "NULL":
            return variable.__content__;
        case "NAME":
            let res = this.context.getVar(variable.__content__);
            return this.resolveToken(res);
        case "ARRAY":
            return this.resolveTokens(variable.__content__);
        case "LAMBDA":
            return (...args) => {
                const resolved = args.map(this.setType);
                let res = this.executeFunction(variable, variable, resolved);
                let a = this.executeInstruction(res);
                return this.resolveToken(a);
            };
        }

        throw `Invalid variable type ${variable.__token__} (${inspect(variable.__content__)})`;
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
            case "BOOLEAN":
            case "NULL":
                return instr;
            case "NAME":
                let a = this.context.getVar(instr.__content__);
                return this.executeInstruction(a);
            }
        }

        throw `Unknown instruction ${instr.__token__}`;
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
        let argsToken = list[list.length - 1];
        let pathToken = list.slice(1, list.length - 1);

        if (!Array.isArray(argsToken)) throw "Need an argument list at last position in the call.";
        
        let obj = this.resolveTokens(pathToken.map(this.executeInstruction));
        let args = this.resolveTokens(argsToken.map(this.executeInstruction));

        let res = obj.reduce((acc, arr) => acc[arr], global).call(...args);

        return this.setType(res);
    }

    /**
     * Declare function
     * 
     * @param {Instruction[]} list - The instruction list
     * @returns {Var<any>} - The variable returned
     */
    operatorFunc(list) {
        if (list.length < 3) throw "Wrong number of arguments in func";

        let { __file__ , __line__ } = list[0];

        let func;
        if (Array.isArray(list[1])) {
            let __params__ = list[1];
            let __instructions__ = list.slice(2, list.length);
            let __name__ = "_" + Math.random().toString(36).substr(2, 9);

            let data = { __instructions__, __params__, __name__, __closure__: this.context };
            func = { __token__: "LAMBDA", __content__: data, __file__, __line__ };
        } else {
            if (list.length < 4) throw "Wrong number of arguments in func " + list[1];

            let __params__ = list[2];
            let __instructions__ = list.slice(3, list.length);
            let __name__ = list[1].__content__;

            let data = { __instructions__, __params__, __name__, __closure__: this.context };
            func = { __token__: "LAMBDA", __content__: data, __file__, __line__ };

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
        if (list.__token__ !== "ARRAY") throw `${inspect(list)} is not an array`;

        let a = {
            /** The iterator */
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
        const nameToken = list[1];
        const dataToken = list[2];

        if (Array.isArray(nameToken)) throw "Instruction is not a token";

        let res = this.executeInstruction(dataToken);

        this.context.setVar(nameToken.__content__, res);

        return res;
    }

    /**
     * Define array
     * 
     * @param {Instruction[]} list - The instruction list
     * @returns {Var<any>} - The variable returned
     */
    operatorArray(list) {
        let entriesToken = list.slice(1, list.length);
        return this.setType(this.resolveTokens(entriesToken.map(this.executeInstruction)));
    }

    /**
     * Import and parse a file
     * 
     * @param {Instruction[]} list - The instruction list
     * @returns {Var<any>} - The variable returned
     */
    operatorImport(list) {
        const argsToken = list[1];
        if (Array.isArray(argsToken) || argsToken.__token__ !== "STRING") throw "Invalid argument";

        const PATH = this.resolveToken(this.context.getVar("PATH"));
        const args = argsToken.__content__.split(".");

        if (!PATH) throw "No path available";

        for (let currPath of PATH) {
            const filePath = path.resolve(currPath, ...args) + ".cr";

            try {
                const data = fs.readFileSync(filePath, "utf8");

                return this.executeInstructions(ast(data, filePath));
            } catch (e) {
                if (e.code === "ENOENT") continue;
                throw e;
            }
        }

        throw `Unknow file ${args.join(".")}`;
    }

    /**
     * Compute nums
     * 
     * @param {Instruction[]} list - The instruction list
     * @returns {Var<any>} - The variable returned
     */
    callArithmetic(list) {
        const opToken = list[0];
        if (Array.isArray(opToken)) throw "Invalid operand";
        const op = opToken.__content__;

        let data = this.resolveTokens(list.slice(1, list.length).map(this.executeInstruction));

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
            throw "Undefined arithmetic" + op;
        }

        return this.setType(res);
    }

    /**
     * Execute function
     * 
     * @param {Var<any>} loc - The function location
     * @param {Var<FunctionData|function>} func - The function
     * @param {Instruction[]} args - The arguments
     * @returns {Var<any>} - The variable returned
     */
    executeFunction(loc, func, args) {
        if (!["LAMBDA", "NATIVE"].includes(func.__token__))
            throw `${typeof func} is not a function (${func.__token__})`;
        let funcData = func.__content__;


        let argsValue = [];
        while (true) {
            let arg = args.shift();
            if (arg === undefined) break;

            let res = this.executeInstruction(arg);
            argsValue.push(res);
        }

        if (func.__token__ === "NATIVE") {
            if (typeof funcData !== "function") throw "Invalid native call";

            return this.setType(funcData(...this.resolveTokens(argsValue)));
        } else {
            this.stack.push({
                file: loc.__file__,
                line: loc.__line__,
                closure: this.context.name,
                func: funcData.__name__,
            });
    
            let backupContext = this.context;
            this.context = funcData.__closure__.createClosure(funcData.__name__);
    
            let index = 0;
            for (let desc of funcData.__params__) {
                this.context.setVar(desc.__content__, argsValue[index]);
                index++;
            }
    
            this.context.setVar("__arguments__", { __token__: "ARRAY", __content__: argsValue });
            this.context.setVar("__name__", this.setType(funcData.__name__));
    
            let result = this.executeInstructions(funcData.__instructions__);
    
            this.context = backupContext;
    
            this.stack.pop();

            return result;
        }
    }

    /**
     * Call native js function
     * 
     * @param {Instruction[]} list - The instruction list
     * @returns {Var<any>} - The variable returned
     */
    callNative(list) {
        const nameToken = list[0];
        if (Array.isArray(nameToken)) throw "Invalid name";

        const name = nameToken.__content__;
        const args = list.slice(1, list.length);

        const func = this.context.getVar(name);

        if (func.__token__ !== "NATIVE") {
            throw `${name} is not a native function (${func.__token__})`;
        }

        return this.setType(func.__content__(args));
    }

    /**
     * Call native js function
     * 
     * @param {Instruction[]} list - The instruction list
     * @returns {Var<any>} - The variable returned
     */
    callAnonymous(list) {
        const func = list[0];
        if (Array.isArray(func) || func.__token__ !== "LAMBDA") throw "Invalid function";

        const args = list.slice(1, list.length);

        return this.executeFunction(func, func, args);
    }

    /**
     * Call native js function
     * 
     * @param {Instruction[]} list - The instruction list
     * @returns {Var<any>} - The variable returned
     */
    callLambda(list) {
        const func = this.executeInstruction(list[0]);
        if (Array.isArray(func) || func.__token__ !== "LAMBDA") throw "Invalid type";

        const args = list.slice(1, list.length);

        return this.executeFunction(func, func, args);
    }

    /**
     * Call native js function
     * 
     * @param {Instruction[]} list - The instruction list
     * @returns {Var<any>} - The variable returned
     */
    callFunction(list) {
        const nameToken = list[0];
        if (Array.isArray(nameToken)) throw "Invalid type";

        const func = this.context.getVar(nameToken.__content__);
        const args = list.slice(1, list.length);

        return this.executeFunction(nameToken, func, args);
    }

    /**
     * Call native js function
     * 
     * @param {Instruction[]} list - The instruction list
     * @returns {Var<any>} - The variable returned
     */
    callOperator(list) {
        const symbolToken = list[0];
        if (Array.isArray(symbolToken)) throw "Invalid type";

        const symbol = symbolToken.__content__;

        switch (symbol) {
        case "import": return this.operatorImport(list);
        case "func": return this.operatorFunc(list);
        case "let": return this.operatorLet(list);
        case "array": return this.operatorArray(list);
        case "sys": return this.operatorSys(list);
        case "if": return this.operatorIf(list);
        }

        throw "Undefined operator " + symbolToken.__content__;
    }

    /**
     * Call native js function
     * 
     * @param {Instruction[]} list - The instruction list
     * @returns {Var<any>} - The variable returned
     */
    processList(list) {
        let op;
        if (Array.isArray(list[0])) {
            return this.callLambda(list);
        } else {
            op = list[0];
        }

        switch (op.__token__) {
        case "STRING":
        case "NUMBER":
        case "ARRAY":
            throw `Invalid __token__ ${op.__token__} in the list (${inspect(op)})`;
        case "NAME": return this.callFunction(list);
        case "LAMBDA": return this.callAnonymous(list);
        case "OPERATOR": return this.callOperator(list);
        case "ARITHMETIC": return this.callArithmetic(list);
        case "NATIVE": return this.callNative(list);
        }

        throw "Undefined __token__: " + op.__token__;
    }

    /**
     * Run the ast in the VM
     * 
     * @param {Instruction[]} tokens - The ast to execute
     * @return {Var<any>} - The result of the execution
     */
    run(tokens) {
        const corePath = path.resolve(__dirname, "..", "lib");

        this.context.setVar("PATH", this.setType([...this.paths, corePath]));

        //return this.executeInstructions(tokens);
        try {
            return this.executeInstructions(tokens);
        } catch (e) {
            console.log(this.getVmError(e));
            //new Debugger().start(context);
        }
    }
}

module.exports = Vm;
