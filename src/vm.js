const fs = require("fs");
const path = require("path");

const ast = require("./ast.js");
const { setDataPath, resolveRecursive, concatPath } = require("./utils/vmUtils.js");

const resolveArgs = (context, args) => {
	let argsValue = [];
	while (true) {
		arg = args.shift();
		if (arg === undefined) break;

		context = resolveVar(context, arg);
		argsValue.push(context.__return__);
	}

	return [context, argsValue];
};

const resolveVar = (context, variable) => {
	if (Array.isArray(variable)) {
		return processList(context, variable);
	}

	let res;
	switch (variable.token) {
		case "STRING": 
			res = JSON.parse(variable.text);
			context.__return__ = res;
			return context;
		case "NUMBER":
			res = parseInt(variable.text);
			context.__return__ = res;
			return context;
		case "NAME":
			const data = resolveRecursive(context, context.__current__, variable.text, false);
			if (data) {
				context.__return__ = data;
				return context;
			} else {
				throw "Variable not found " + variable.text;
			}
	}

	throw "Invalid variable type " + variable.token;
}

const executeInstructions = (context, list) => {
	for (const data of list) {
		if (Array.isArray(data)) {
			context = processList(context, data);
		} else {
			context = resolveVar(context, data);
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
		const __params__ = list[1];
		const __instructions__ = list.slice(2, list.length);
		const __name__ = '_' + Math.random().toString(36).substr(2, 9);
		const __namespace__ = concatPath(context.__current__, __name__);
		const token = "LAMBDA";

		context.__return__ = { token, __instructions__, __params__, __name__, __namespace__ };
	} else {
		if (list.length < 4) throw "Wrong number of arguments in func " + list[1];

		const __params__ = list[2];
		const __instructions__ = list.slice(3, list.length);
		const __name__ = list[1].text;
		const __namespace__ = concatPath(context.__current__, __name__);
		const token = "LAMBDA";

		const func = { token, __instructions__, __params__, __namespace__, __name__ };
		setDataPath(context, context.__current__, __name__, func);
		context.__return__ = func;
	}

	return context;
};

const operatorIf = (context, list) => {
	const condition = list[1];
	const valid = list[2];
	const invalid = list[3];

	context = resolveVar(context, condition);

	if (context.__return__) {
		context = resolveVar(context, valid);
	} else {
		context = resolveVar(context, invalid);
	}

	return context;
};

const operatorLet = (context, list) => {
	const name = list[1].text;
	const data = list[2];

	context = resolveVar(context, data);

	setDataPath(context, context.__current__, name, context.__return__);
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

	let index = 0;
	for (let desc of func.__params__) {
		setDataPath(context, func.__namespace__, desc.text, argsValue[index]);
		index++;
	}
	setDataPath(context, func.__namespace__, "__arguments__", argsValue);
	console.log(context);

	let savedContext = context.__current__;
	context.__current__ = concatPath(func.__namespace__, func.__name__);

	context = executeInstructions(context, func.__instructions__);
	context.__current__ = savedContext;

	return context;
};

const callFunction = (context, list) => {
	let argsValue;

	const name = list[0].text;
	const args = list.slice(1, list.length);

	context = resolveVar(context, { token: "NAME", text: name });
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

	//console.log(context);
	console.log("Execute " + JSON.stringify(op));
	switch (op.token) {
		case "STRING":
		case "SPREAD":
		case "NUMBER": throw `Invalid token ${op.token} in the list (${op.text})`;

		case "LAMBDA": return callLambda(context, list);
		case "NAME": return callFunction(context, list);
		case "OPERATOR": return callOperator(context, list);
		case "ARITHMETIC": return callArithmetic(context, list);
	}

	throw "Undefined token" + op;
};

module.exports = (path) => {
	const initialContext = { __path__: path , __current__: "" };

	return tokens => executeInstructions(initialContext, tokens);
};
