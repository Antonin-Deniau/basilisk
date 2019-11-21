const fs = require("fs");
const path = require("path");

const ast = require("./ast.js");
const { getPathAndName, resolveRecursive, setDataPath } = require("./utils/vmUtils.js");

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

		throw "Unknown variable " + data;
	}
}

let context = new Closure(undefined, "__G");

const resolveArgs = args => {
	let argsValue = [];
	while (true) {
		arg = args.shift();
		if (arg === undefined) break;

		res = resolveToken(arg);
		argsValue.push(res);
	}

	return argsValue;
};

const resolveToken = variable => {
	console.log(variable)

	switch (variable.__token__) {
		case "STRING": 
			return JSON.parse(variable.text);
		case "NUMBER":
			return parseInt(variable.text);
		case "NAME":
			return context.getVar(variable.text);
		case "ARRAY":
			return variable.text;
		case "LAMBDA":
			return variable;
	}

	console.trace()
	throw "Invalid variable type " + variable.__token__;
}

const executeInstructions = list => {
	let res;

	for (const data of list) {
		if (Array.isArray(data)) {
			res = processList(data);
		} else {
			res = resolveToken(data);
		}
	}

	return res;
};

const operatorSys = list => {
	let path, args;

	path = resolveArgs(list.slice(1, list.length - 1));
	args = resolveArgs(list[list.length - 1]);

	return path.reduce((acc, arr) => acc[arr], global)(...args);
};

const operatorFunc = list => {
	let func;
	if (list.length < 3) throw "Wrong number of arguments in func";

	if (Array.isArray(list[1])) {
		const name = '_' + Math.random().toString(36).substr(2, 9);

		const __params__ = list[1];
		const __instructions__ = list.slice(2, list.length);
		const __name__ = name;
		const __token__ = "LAMBDA";
		const __closure__ = context;

		func = { __token__, __instructions__, __params__, __name__, __closure__ };
	} else {
		if (list.length < 4) throw "Wrong number of arguments in func " + list[1];

		const __params__ = list[2];
		const __instructions__ = list.slice(3, list.length);
		const __name__ = list[1].text;
		const __token__ = "LAMBDA";
		const __closure__ = context;

		func = { __token__, __instructions__, __params__, __name__, __closure__ };

		context.setVar(__name__, func);
	}

	return func;
};

const operatorIf = list => {
	const condition = list[1];
	const valid = list[2];
	const invalid = list[3];

	result = resolveToken(condition);

	if (result) {
		return resolveToken(valid);
	} else {
		return resolveToken(invalid);
	}
};

const operatorLet = list => {
	const name = list[1].text;
	const data = list[2];

	res = processList(data);

	context.setVar(name, res);

	return res;
};

const operatorArray = list => {
	return { __token__: "ARRAY", text: resolveArgs(list.slice(1, list.length)) };
};

const operatorReduce = list => {
	let func, init, data;

	data = resolveToken(list[1]);
	func = resolveToken(list[2]);
	init = resolveToken(list[3]);

	let res = init;
	for (let item of data) {
		res = executeFunction(func, [res, item]);
	}

	return res;
};

const operatorImport = list => {
	const arg = JSON.parse(list[1].text).split(".");
	const PATH = context.getVar("PATH");

	if (!PATH) throw "No path available";

	for (let currPath of PATH) {
		const filePath = path.resolve(currPath, ...arg) + ".cr";

		try {
			const data = fs.readFileSync(filePath, 'utf8');

			return executeInstructions(ast(data));
		} catch (e) {
			if (e.code === "ENOENT") continue;
			throw e;
		}
	}

	throw "Unknow file " + arg.join(".");
};

const callArithmetic = list => {
	let dataValues;

	const op = list[0].text;

	data = resolveArgs(list.slice(1, list.length));

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

	return res;
};

const callLambda = list => {
	func = callFunction(list[0]);
	const args = list.slice(1, list.length);

	return executeFunction(func, args);
};

const executeFunction = (func, args) => {
	argsValue = resolveArgs(args);

	backupContext = context;

	context = func.__closure__;
	context = context.createClosure(func.__name__);

	let index = 0;
	for (let desc of func.__params__) {
		context.setVar(desc.text, argsValue[index]);
		index++;
	}
	context.setVar("__arguments__", argsValue);
	context.setVar("__name__", func.__name__);

	result = executeInstructions(func.__instructions__);

	context = backupContext;

	return result;
};

const callFunction = list => {
	const name = list[0].text;
	const args = list.slice(1, list.length);

	const func = context.getVar(name);

	return executeFunction(func, args);
};

const callOperator = list => {
	const symbol = list[0].text;

	switch (symbol) {
		case "import": return operatorImport(list);
		case "func": return operatorFunc(list);
		case "let": return operatorLet(list);
		case "array": return operatorArray(list);
		case "sys": return operatorSys(list);
		case "if": return operatorIf(list);
		case "reduce": return operatorReduce(list);
	}

	throw "Undefined operator " + list[0].text;
};

const processList = list => {
	let op;
	if (Array.isArray(list[0])) {
		op = processList(list[0]);
	} else {
		op = list[0];
	}

	const args = list.slice(1, list.length);

	//console.log(JSON.stringify(op));
	switch (op.__token__) {
		case "STRING":
		case "NUMBER": throw `Invalid __token__ ${op.__token__} in the list (${op.text})`;

		case "LAMBDA": return callLambda(list);
		case "NAME": return callFunction(list);
		case "OPERATOR": return callOperator(list);
		case "ARITHMETIC": return callArithmetic(list);
	}

	throw "Undefined __token__" + op;
};

module.exports = (path) => {
	context.setVar("PATH", path)

	return tokens => executeInstructions(tokens);
};
