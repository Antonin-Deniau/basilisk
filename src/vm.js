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
 * @property {integer} line - File line of the token
 * @property {closure} Closure - Closure of the token
 * @property {string} func - Function of the token
 */

/**
 * @typedef Stack - The stack of the vm
 * @type {StackEntry[]}
 */

/**
 * @typedef {object} Var - A vm variable
 * @property {string} __token__ - Variable type.
 * @property {any} __content__ - The content of the variable.
 */

/** @type Stack */
let stack = [];

let context = new Closure(undefined, "__G");

const setType = __content__ => {
    switch (typeof __content__) {
    case "number": return { __token__: "NUMBER", __content__ };
    case "string": return { __token__: "STRING", __content__ };
    case "boolean": return { __token__: "BOOLEAN", __content__ };
    case "function": return { __token__: "NATIVE", __content__ };
    case "object":
        if (Array.isArray(__content__)) {
            return {
                __token__: "ARRAY",
                __content__: __content__.map(setType),
            };
        }
    }

    throw new VmError(`Invalid type ${typeof __content__} (${inspect(__content__)})`);
};

function resolveTokens(vars) {
    return vars.map(resolveToken);
}

function resolveToken(variable) {

/** @type Stack */
let stack = [];
    switch (variable.__token__) {
    case "STRING": 
    case "BOOLEAN":
    case "NATIVE":
    case "NUMBER":
    case "UNDEFINED":
        return variable.__content__;
    case "NAME":
        let res = context.getVar(variable.__content__);
        return resolveToken(res);
    case "ARRAY":
        return resolveTokens(variable.__content__);
    case "LAMBDA":
        return function(...args) {
            let res = executeFunction(variable, variable.__content__, args);
            return resolveToken(executeInstruction(res));
        };
    }

    throw new VmError(`Invalid variable type ${variable.__token__} (${inspect(variable.__content__)})`);
}

function executeInstruction(instr) {
    if (Array.isArray(instr)) {
        return processList(instr);
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
            let a = context.getVar(instr.__content__);
            return executeInstruction(a);
        }
    }
};

function executeInstructions(list) {
    let res;

    for (const data of list) {
        res = executeInstruction(data);
    }

    return res;
};

function operatorSys(list) {
    let path = resolveTokens(list.slice(1, list.length - 1).map(executeInstruction));
    let args = resolveTokens(list[list.length - 1].map(executeInstruction));

    let res = path.reduce((acc, arr) => acc[arr], global).call(...args);

    return setType(res);
};

function operatorFunc(list) {
    let func;

    if (list.length < 3) throw new VmError("Wrong number of arguments in func");

    let d = { __token__: "LAMBDA", __closure__: context };

    if (Array.isArray(list[1])) {
        let __params__ = list[1];
        let __instructions__ = list.slice(2, list.length);
        let __name__ = "_" + Math.random().toString(36).substr(2, 9);

        func = { ...d, __instructions__, __params__, __name__ };
    } else {
        if (list.length < 4) throw new VmError("Wrong number of arguments in func " + list[1]);

        let __params__ = list[2];
        let __instructions__ = list.slice(3, list.length);
        let __name__ = list[1].__content__;

        func = { ...d, __instructions__, __params__, __name__ };

        context.setVar(__name__, func);
    }

    return func;
};

function operatorIf(list) {
    const condition = list[1];
    const valid = list[2];
    const invalid = list[3];

    result = resolveToken(executeInstruction(condition));

    let res; 
    if (result) {
        res = executeInstruction(valid);
    } else {
        res = executeInstruction(invalid);
    }

    return res;
};

function iterateOnArray(list) {
    if (list.__token__ !== "ARRAY") throw new VmError(`${inspect(list)} is not an array`);

    let a = {};
    a[Symbol.iterator] = function* () {
        for (let item of list.__content__) {
            yield item;
        }
    };
    return a;
}

function operatorLet(list) {
    const name = list[1].__content__;
    const data = list[2];

    res = executeInstruction(data);

    context.setVar(name, res);

    return res;
};

function operatorArray(list) {
    return setType(resolveTokens(list.slice(1, list.length)));
};

function operatorImport(list) {
    const arg = list[1].__content__.split(".");
    const PATH = context.getVar("PATH");

    if (!PATH) throw new VmError("No path available");

    for (let currPath of PATH) {
        const filePath = path.resolve(currPath, ...arg) + ".cr";

        try {
            const data = fs.readFileSync(filePath, "utf8");

            return executeInstructions(ast(data, filePath));
        } catch (e) {
            if (e.code === "ENOENT") continue;
            throw new VmError(e);
        }
    }

    throw new VmError("Unknow file " + arg.join("."));
};

function callArithmetic(list) {
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
};

function executeFunction(loc, func, args) {
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
        closure: context.name,
        func: func.__name__,
    });

    let bk = context.name;
    let backupContext = context;
    context = func.__closure__.createClosure(func.__name__);

    let index = 0;
    for (let desc of func.__params__) {
        context.setVar(desc.__content__, argsValue[index]);
        index++;
    }
    context.setVar("__arguments__", setType(resolveTokens(argsValue)));
    context.setVar("__name__", setType(func.__name__));

    result = executeInstructions(func.__instructions__);

    context = backupContext;

    stack.pop();
    return result;
};

function callNative(list) {
    const name = list[0].__content__;
    const args = list.slice(1, list.length);

    const func = context.getVar(name);

    if (func.__token__ !== "NATIVE") {
        throw new VmError(`${name} is not a native function (${func.__token__})`);
    }

    return setType(func.__content__(args));
}


function callAnonymous(list) {
    const func = list[0];
    const args = list.slice(1, list.length);

    return executeFunction(list[0], func, args);
}

function callLambda(list) {
    const func = executeInstruction(list[0]);

    const args = list.slice(1, list.length);

    return executeFunction(list[0], func, args);
}

function callFunction(list) {
    const name = list[0].__content__;

    const func = context.getVar(name);
    const args = list.slice(1, list.length);

    return executeFunction(list[0], func, args);
}

function callOperator(list) {
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

function processList(list) {
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

module.exports = (tokens, additionalsPath = []) => {
    const corePath = path.resolve(__dirname, "..", "lib");

    context.setVar("PATH", [...additionalsPath, corePath]);

    try {
        return executeInstructions(tokens);
    } catch (e) {
        console.log(e);
        console.log(e.message);
        //new Debugger().start(context);
    }
};
