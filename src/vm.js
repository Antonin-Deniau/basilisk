const fs = require("fs");
const path = require("path");

const ast = require("./ast.js");
const { getPathAndName, resolveRecursive, setDataPath, concatPath } = require("./utils/vmUtils.js");

const getVar = (context, data) => {
	let stacks = [...context.__stack__];

	while (true) {
		let ns = stacks.pop();
		if (ns === undefined) break;

		let [path, name] = getPathAndName(context.__current__, data);

		if (data === "functions") {
			console.log("--------")
			console.log(ns)
		}
		let res = resolveRecursive(ns, path.join("."), name, undefined);

		if (res !== undefined) return res;
	}


	throw "Unknown variable " + data;
}
const setVar = (context, data, value) => {
	let ns = context.__stack__.pop();

	let [path, name] = getPathAndName(context.__current__, data);

	setDataPath(ns, path, name, value);

	context.__stack__.push(ns);
	return context;
};

const resolveArgs = (context, args) => {
	let argsValue = [];
	while (true) {
		arg = args.shift();
		if (arg === undefined) break;

		context = resolveToken(context, arg);
		argsValue.push(context.__return__);
	}

	return [context, argsValue];
};

const resolveToken = (context, variable) => {
	if (Array.isArray(variable)) {
		return processList(context, variable);
	}

	let res;
	switch (variable.__token__) {
		case "STRING": 
			context.__return__ = JSON.parse(variable.text);
			return context;
		case "NUMBER":
			context.__return__ = parseInt(variable.text);
			return context;
		case "NAME":
			let data = getVar(context, variable.text);
			context.__return__ = data;
			return context;

	}

	throw "Invalid variable type " + variable.__token__;
}

const executeInstructions = (context, list) => {
	for (const data of list) {
		if (Array.isArray(data)) {
			context = processList(context, data);
		} else {
			context = resolveToken(context, data);
		}
	}

	return context;
};

const operatorSys = (context, list) => {
	let path, args;

	[context, path] = resolveArgs(context, list.slice(1, list.length - 1));
	[context, args] = resolveArgs(context, list[list.length - 1]);

	context.__return__ = path.reduce((acc, arr) => acc[arr], global)(...args);
	return context;
};

const operatorFunc = (context, list) => {
	if (list.length < 3) throw "Wrong number of arguments in func";

	if (Array.isArray(list[1])) {
		const [path, name] = getPathAndName(context.__current__, '_' + Math.random().toString(36).substr(2, 9));

		const __params__ = list[1];
		const __instructions__ = list.slice(2, list.length);
		const __name__ = name;
		const __token__ = "LAMBDA";

		const func = { __token__, __instructions__, __params__, __name__ };
		context.__return__ = func;
	} else {
		if (list.length < 4) throw "Wrong number of arguments in func " + list[1];

		const [path, name] = getPathAndName(context.__current__, list[1].text);

		const __params__ = list[2];
		const __instructions__ = list.slice(3, list.length);
		const __name__ = name;
		const __token__ = "LAMBDA";

		const func = { __token__, __instructions__, __params__, __name__ };
		setVar(context, __name__, func);
		context.__return__ = func;
	}

	return context;
};

const operatorIf = (context, list) => {
	const condition = list[1];
	const valid = list[2];
	const invalid = list[3];

	context = resolveToken(context, condition);

	if (context.__return__) {
		context = resolveToken(context, valid);
	} else {
		context = resolveToken(context, invalid);
	}

	return context;
};

const operatorLet = (context, list) => {
	const name = list[1].text;
	const data = list[2];

	context = resolveToken(context, data);

	setVar(context, name, context.__return__);
	return context;
};

const operatorArray = (context, list) => {
	let arr;
	[context, arr] = resolveArgs(context, list.slice(1, list.length));
	context.__return__ = arr;

	return context;
};

const operatorReduce = (context, list) => {
	let arr;
	[context, arr] = resolveArgs(context, list.slice(1, list.length));
	context.__return__ = arr;

	return context;
};

const operatorImport = (context, list) => {
	const arg = JSON.parse(list[1].text).split(".");
	if (context.__path__) {
		var PATH = context.__path__;
	} else {
		throw "No path available";
	}

	for (let currPath of PATH) {
		const filePath = path.resolve(currPath, context.__current__, ...arg) + ".cr";

		try {
			const data = fs.readFileSync(filePath, 'utf8');

			context = executeInstructions(context, ast(data));

			return context;
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

	context.__return__ = res;
	return context;
};

const callLambda = (context, list) => {
	context = callFunction(context, list[0]);
	const func = context.__return__;
	const args = list.slice(1, list.length);

	return executeFunction(context, func, args);
};

const executeFunction = (context, func, args) => {
	[context, argsValue] = resolveArgs(context, args);

	context.__stack__.push({});

	let index = 0;
	for (let desc of func.__params__) {
		setVar(context, desc.text, argsValue[index]);
		index++;
	}
	setVar(context, "__arguments__", argsValue);

	context = executeInstructions(context, func.__instructions__);

	context.__stack__.pop();

	return context;
};

const callFunction = (context, list) => {
	let argsValue;

	const name = list[0].text;
	const args = list.slice(1, list.length);

	context = resolveToken(context, { __token__: "NAME", text: name });
	const func = context.__return__;

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
		context = processList(context, list[0]);
		op = context.__return__;
	} else {
		op = list[0];
	}

	const args = list.slice(1, list.length);

	//console.log("Execute " + JSON.stringify(op));
	switch (op.__token__) {
		case "STRING":
		case "SPREAD":
		case "NUMBER": throw `Invalid __token__ ${op.__token__} in the list (${op.text})`;

		case "LAMBDA": return callLambda(context, list);
		case "NAME": return callFunction(context, list);
		case "OPERATOR": return callOperator(context, list);
		case "ARITHMETIC": return callArithmetic(context, list);
	}

	throw "Undefined __token__" + op;
};

module.exports = (path) => {
	const initialContext = { __path__: path , __current__: "", __stack__: [{}] };


	return tokens => executeInstructions(initialContext, tokens);
};
