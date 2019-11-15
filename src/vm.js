const fs = require("fs");
const path = require("path");

const ast = require("./ast.js");
const { getPathAndName, resolveRecursive, setDataPath } = require("./utils/vmUtils.js");

const currentClosure = context => {
	const ns = resolvePath(context, context.__current__, undefined);
	return ns;
};

const getVar = (context, data) => {
	let ns, clo;
	[clo, currentPath] = currentClosure(context);

	while (true) {
		ns = closureNamespace(clo);

		let [path, name] = getPathAndName(data);
		let res = resolveRecursive(ns, path.join("."), name, undefined);

		if (res !== undefined) return res;

		[clo, currentPath] = prevClosure(context, currentPath);
		if (clo === undefined) break;
	}

	throw "Unknown variable " + data;
};

const setVar = (context, data, value) => {
	[clo, currentPath] = currentClosure(context);
	ns = getClosureNamespace(clo);

	let [path, name] = getPathAndName(data);

	setDataPath(ns, path, name, value);

	clo = setClosureNamespace(clo, ns);
	context = closurePush(context, ns);
	return context;
};

const resolveArgs = (context, args) => {
	let argsValue = [];
	while (true) {
		arg = args.shift();
		if (arg === undefined) break;

		[context, res] = resolveToken(context, arg);
		argsValue.push(res);
	}

	return [context, argsValue];
};

const resolveToken = (context, variable) => {
	if (Array.isArray(variable)) {
		return processList(context, variable);
	}

	switch (variable.__token__) {
		case "STRING": 
			return [context, JSON.parse(variable.text)];
		case "NUMBER":
			return [context, parseInt(variable.text)];
		case "NAME":
			return [context, getVar(context, variable.text)];

	}

	throw "Invalid variable type " + variable.__token__;
}

const executeInstructions = (context, list) => {
	let res;

	for (const data of list) {
		if (Array.isArray(data)) {
			[context, res] = processList(context, data);
		} else {
			[context, res] = resolveToken(context, data);
		}
	}

	return [context, res];
};

const operatorSys = (context, list) => {
	let path, args;

	[context, path] = resolveArgs(context, list.slice(1, list.length - 1));
	[context, args] = resolveArgs(context, list[list.length - 1]);

	return [context, path.reduce((acc, arr) => acc[arr], global)(...args)];
};

const operatorFunc = (context, list) => {
	let func;
	if (list.length < 3) throw "Wrong number of arguments in func";

	if (Array.isArray(list[1])) {
		const name = '_' + Math.random().toString(36).substr(2, 9);

		const __params__ = list[1];
		const __instructions__ = list.slice(2, list.length);
		const __name__ = name;
		const __token__ = "LAMBDA";

		func = { __token__, __instructions__, __params__, __name__ };
	} else {
		if (list.length < 4) throw "Wrong number of arguments in func " + list[1];

		const __params__ = list[2];
		const __instructions__ = list.slice(3, list.length);
		const __name__ = list[1].text;
		const __token__ = "LAMBDA";

		func = { __token__, __instructions__, __params__, __name__ };
		context = setVar(context, __name__, func);
	}

	return [context, func];
};

const operatorIf = (context, list) => {
	const condition = list[1];
	const valid = list[2];
	const invalid = list[3];

	[context, result] = resolveToken(context, condition);

	if (result) {
		return resolveToken(context, valid);
	} else {
		return resolveToken(context, invalid);
	}
};

const operatorLet = (context, list) => {
	const name = list[1].text;
	const data = list[2];

	[context, res] = resolveToken(context, data);

	context = setVar(context, name, res);

	return [context, res];
};

const operatorArray = (context, list) => {
	return resolveArgs(context, list.slice(1, list.length));
};

const operatorReduce = (context, list) => {
	let func, init, data;

	[context, data] = resolveToken(context, list[1]);
	[context, func] = resolveToken(context, list[2]);
	[context, init] = resolveToken(context, list[3]);

	let res = init;
	for (let item of data) {
		[context, res] = executeFunction(context, func, [res, item]);
	}

	return [context, res];
};

const operatorImport = (context, list) => {
	const arg = JSON.parse(list[1].text).split(".");
	const PATH = getVar(context, "PATH");

	if (!PATH) throw "No path available";

	for (let currPath of PATH) {
		const filePath = path.resolve(currPath, ...arg) + ".cr";

		try {
			const data = fs.readFileSync(filePath, 'utf8');

			return executeInstructions(context, ast(data));
		} catch (e) {
			if (e.code === "ENOENT") continue;
			throw e;
		}
	}

	throw "Unknow file " + arg.join(".");
};

const callArithmetic = (context, list) => {
	let dataValues;

	const op = list[0].text;

	[context, data] = resolveArgs(context, list.slice(1, list.length));

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

	return [context, res];
};

const callLambda = (context, list) => {
	[context, func] = callFunction(context, list[0]);
	const args = list.slice(1, list.length);

	return executeFunction(context, func, args);
};

const executeFunction = (context, func, args) => {
	[context, argsValue] = resolveArgs(context, args);

	closurePush(context, {});

	let index = 0;
	for (let desc of func.__params__) {
		context = setVar(context, desc.text, argsValue[index]);
		index++;
	}
	context = setVar(context, "__arguments__", argsValue);
	context = setVar(context, "__name__", func.__name__);

	[context, result] = executeInstructions(context, func.__instructions__);

	context = closurePop(context);

	return [context, result];
};

const callFunction = (context, list) => {
	const name = list[0].text;
	const args = list.slice(1, list.length);

	const func = getVar(context, name);

	return executeFunction(context, func, args);
};

const callOperator = (context, list) => {
	const symbol = list[0].text;

	switch (symbol) {
		case "import": return operatorImport(context, list);
		case "func": return operatorFunc(context, list);
		case "let": return operatorLet(context, list);
		case "array": return operatorArray(context, list);
		case "sys": return operatorSys(context, list);
		case "if": return operatorIf(context, list);
		case "reduce": return operatorReduce(context, list);
	}

	throw "Undefined operator " + list[0].text;
};

const processList = (context, list) => {
	let op;
	if (Array.isArray(list[0])) {
		[context, op] = processList(context, list[0]);
	} else {
		op = list[0];
	}

	const args = list.slice(1, list.length);

	//console.log(JSON.stringify(op));
	switch (op.__token__) {
		case "STRING":
		case "NUMBER": throw `Invalid __token__ ${op.__token__} in the list (${op.text})`;

		case "LAMBDA": return callLambda(context, list);
		case "NAME": return callFunction(context, list);
		case "OPERATOR": return callOperator(context, list);
		case "ARITHMETIC": return callArithmetic(context, list);
	}

	throw "Undefined __token__" + op;
};

module.exports = (path) => {
	const initialContext = [{ PATH: path }];

	return tokens => executeInstructions(initialContext, tokens);
};
