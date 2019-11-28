const { inspect } = require("util");
const fs = require("fs");
const path = require("path");

const Debugger = require("./debugger");
const ast = require("./ast.js");
const { getPathAndName, resolveRecursive, setDataPath } = require("./utils/vmUtils.js");

let stack = [];
class VmError extends Error {
	constructor(e) {
		let line = e => `\t${e.file}:${e.line}\t${e.closure}:${e.func}()`;
		super(`Error: ${e}\n${stack.map(line).join("\n")}\n`);
	}
}

class Closure {
	constructor(prev, name) {
		this.prev = prev;
		this.name = name;
		this.deps = [];
		this.data = {};
	}

	createClosure(name) {
		return new Closure(this, name);
	}

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

let context = new Closure(undefined, "__G");

const setType = (parnt, __content__) => {
	let { __file__, __line__ } = parnt;
	let d = { __file__, __line__ };

	switch (typeof __content__) {
		case "number": return { ...d, __token__: "NUMBER", __content__ };
		case "string": return { ...d, __token__: "STRING", __content__ };
		case "boolean": return { ...d, __token__: "BOOLEAN", __content__ };
		case "function": return { ...d, __token__: "NATIVE", __content__ };
		case "object":
			if (Array.isArray(__content__)) {
				return {
					...d,
					__token__: "ARRAY",
					__content__: __content__.map(e => setType(parnt, e)),
				};
			}
	}

	throw new VmError(`Invalid type ${typeof __content__} (${inspect(__content__)})`);
};

const resolveTokens = vars => vars.map(resolveToken);

const resolveToken = variable => {
	switch (variable.__token__) {
		case "STRING": 
			return JSON.parse(variable.__content__);
		case "BOOLEAN":
		case "NATIVE":
			return variable.__content__;
		case "NUMBER":
			return parseInt(variable.__content__);
		case "NAME":
			res = context.getVar(variable.__content__);
			return resolveToken(res)
		case "ARRAY":
			return resolveTokens(variable.__content__);
		case "LAMBDA":
			return (...args) => {
				let res = executeFunction(variable, variable.__content__, args);
				return resolveToken(executeInstruction(res));
			};
	}

	throw new VmError(`Invalid variable type ${variable.__token__} (${inspect(variable.__content__)})`);
}

const executeInstruction = instr => {
	if (Array.isArray(instr)) {
		return processList(instr);
	} else {
		switch (instr.__token__) {
			case "STRING": 
			case "NUMBER":
			case "ARRAY":
			case "LAMBDA":
			case "NATIVE":
				return instr;
			case "NAME":
				return executeInstruction(context.getVar(instr.__content__));
		}
	}
};

const executeInstructions = list => {
	let res;

	for (const data of list) {
		res = executeInstruction(data);
	}

	return res;
};

const operatorSys = list => {
	let path = resolveTokens(list.slice(1, list.length - 1).map(executeInstruction));
	let args = resolveTokens(list[list.length - 1].map(executeInstruction));

	let res = path.reduce((acc, arr) => acc[arr], global).call(...args);

	return setType(list[0], res);
};

const operatorFunc = list => {
	let func;

	if (list.length < 3) throw new VmError("Wrong number of arguments in func");

	let d = { __token__: "LAMBDA", __closure__: context };

	if (Array.isArray(list[1])) {
		let __params__ = list[1];
		let __instructions__ = list.slice(2, list.length);
		let __name__ = '_' + Math.random().toString(36).substr(2, 9);

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

const operatorIf = list => {
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

const iterateOnArray = list => {
	if (list.__token__ !== "ARRAY") throw new VmError(`${inspect(list)} is not an array`);

	let a = {};
	a[Symbol.iterator] = function* () {
		for (let item of list.__content__) {
			yield item;
		}
	}
	return a;
}

const operatorLet = list => {
	const name = list[1].__content__;
	const data = list[2];

	res = executeInstruction(data);

	context.setVar(name, res);

	return res;
};

const operatorArray = list => {
	return setType(list[0], list.slice(1, list.length).map(resolveToken));
};

const operatorImport = list => {
	const arg = JSON.parse(list[1].__content__).split(".");
	const PATH = context.getVar("PATH");

	if (!PATH) throw new VmError("No path available");

	for (let currPath of PATH) {
		const filePath = path.resolve(currPath, ...arg) + ".cr";

		try {
			const data = fs.readFileSync(filePath, 'utf8');

			return executeInstructions(ast(data, filePath));
		} catch (e) {
			if (e.code === "ENOENT") continue;
			throw new VmError(e);
		}
	}

	throw new VmError("Unknow file " + arg.join("."));
};

const callArithmetic = list => {
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

	return setType(list[0], res);
};

const executeFunction = (loc, func, args) => {
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

	backupContext = context;
	context = func.__closure__.createClosure(func.__name__);

	let index = 0;
	for (let desc of func.__params__) {
		context.setVar(desc.__content__, argsValue[index]);
		index++;
	}
	context.setVar("__arguments__", argsValue);
	context.setVar("__name__", func.__name__);

	result = executeInstructions(func.__instructions__);

	context = backupContext;

	stack.pop();
	return result;
};

const callNative = list => {
	const name = list[0].__content__;
	const args = list.slice(1, list.length);


	const func = context.getVar(name);

	if (func.__token__ !== "NATIVE") {
		throw new VmError(`${name} is not a native function (${func.__token__})`);
	}

	return setType(func.__content__(args));
};


const callAnonymous = list => {
	const func = list[0];
	const args = list.slice(1, list.length);

	return executeFunction(list[0], func, args);
};

const callLambda = list => {
	const func = executeInstruction(list[0]);
	const args = list.slice(1, list.length);

	return executeFunction(list[0], func, args);
};

const callFunction = list => {
	const name = list[0].__content__;

	const func = context.getVar(name);
	const args = list.slice(1, list.length);

	return executeFunction(list[0], func, args);
};

const callOperator = list => {
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
};

const processList = list => {
	let op;
	if (Array.isArray(list[0])) {
		return callLambda(list);
	} else {
		op = list[0];
	}

	switch (op.__token__) {
		case "STRING":
		case "NUMBER":
			throw new VmError(`Invalid __token__ ${op.__token__} in the list (${op.__content__})`);
		case "NAME": return callFunction(list);
		case "LAMBDA": return callAnonymous(list);
		case "OPERATOR": return callOperator(list);
		case "ARITHMETIC": return callArithmetic(list);
		case "NATIVE": return callNative(list);
	}

	console.log(inspect(list))
	throw new VmError("Undefined __token__: " + op.__token__);
};

module.exports = (path) => {
	context.setVar("PATH", path)

	return tokens => {
		try {
			executeInstructions(tokens);
		} catch (e) {
			console.log(e);
			console.log(e.message);
			new Debugger().start(context);
		}
	};
};
