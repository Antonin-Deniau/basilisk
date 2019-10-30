const fs = require("fs");
const path = require("path");

const ast = require("./ast.js");
const { setDataPath, resolveRecursive, concatPath } = require("./utils/vmUtils.js");

const resolveArgs = (context, args) => {
	let argsValue = [];
	for (let arg of args) {
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
		const __args__ = list[1];
		const __instructions__ = list.slice(2, list.length);
		const __name__ = '_' + Math.random().toString(36).substr(2, 9);

		context.__return__ = { __instructions__, __args__ };
	} else {
		if (list.length < 4) throw "Wrong number of arguments in func " + list[1];

		const __args__ = list[2];
		const __instructions__ = list.slice(3, list.length);
		const __name__ = list[1].text;

		const func = { __instructions__, __args__, __name__ };
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

const operatorPipe = (context, list) => {
	let functions;

	[context, functions] = resolveArgs(context, list.slice(2, list.length));

	context = resolveVar(context, list[1]);
	for (let func of functions) {
		context = executeFunction(context, func, context.__return__);
	}

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

const executeFunction = (context, func, args) => {
	let savedContext = context.__current__;
	context.__current__ = concatPath(context.__current__, func.__name__);

	func.__args__.forEach((name, index) => {
		setDataPath(context, context.__current__, name.text, args[index]);
	});

	context = executeInstructions(context, func.__instructions__);
	context.__current__ = savedContext;

	return context;
};

const callFunction = (context, list) => {
	let argsValue;

	const name = list[0].text;
	const args = list.slice(1, list.length);

	context.__return__ = null;

	context = resolveVar(context, { token: "NAME", text: name });
	const func = context.__return__;

	[context, argsValue] = resolveArgs(context, args);

	return executeFunction(context, func, argsValue);
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
		case "pipe": return operatorPipe(context, list);
		//case "filter": return operatorFilter(context, list);
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

	switch (op.token) {
		case "STRING":
		case "NUMBER": throw `Invalid token ${op.token} in the list (${op.text})`;

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
