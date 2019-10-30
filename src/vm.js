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

const callSys = (context, list) => {
	let path, args;

	[context, path] = resolveArgs(context, list.slice(1, list.length - 1));
	[context, args] = resolveArgs(context, list[list.length - 1]);

	context.__return__ = path.reduce((acc, arr) => acc[arr], global)(...args);

	return context;
};

const defineFunction = (context, list) => {
	if (list.length < 3) throw "Wrong number of arguments in func";

	if (Array.isArray(list[1])) {
		const __args__ = list[1];
		const __instructions__ = list.slice(2, list.length);

		context.__return__ = { __instructions__, __args__ };
	} else {
		if (list.length < 4) throw "Wrong number of arguments in func " + list[1];

		const name = list[1].text;
		const __args__ = list[2];
		const __instructions__ = list.slice(3, list.length);

		const func = { __instructions__, __args__ };
		setDataPath(context, context.__current__, name, func);
		context.__return__ = func;
	}

	return context;
};

const callTernary = (context, list) => {
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

const defineVariable = (context, list) => {
	const name = list[1].text;
	const data = list[2];

	context = resolveVar(context, data);

	setDataPath(context, context.__current__, name, context.__return__);
	return context;
};

const defineArray = (context, list) => {
	let arr;
	[context, arr] = resolveArgs(context, list.slice(1, list.length));
	context.__return__ = arr;

	return context;
};

const definePipe = (context, list) => {
	let functions;

	context = resolveVar(list[1]);
	const data = context.__return__;

	[context, functions] = resolveVar(context, list.slice(2, list.length));

	return context;
};

const defineImport = (context, list) => {
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
			continue;
		}
	}

	throw "Unknow file " + arg.join(".");
};

const arithmetic = (context, list) => {
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

const callFunction = (context, list) => {
	let argsValue;

	const name = list[0].text;
	const args = (list.length > 1 ? list.slice(1, list.length) : []);

	context.__return__ = null;

	context = resolveVar(context, { token: "NAME", text: name });
	const func = context.__return__;

	[context, argsValue] = resolveArgs(context, args);

	let savedContext = context.__current__;
	context.__current__ = concatPath(context.__current__, name);

	func.__args__.forEach((name, index) => {
		setDataPath(context, context.__current__, name.text, argsValue[index]);
	});

	let nextContext = executeInstructions(context, func.__instructions__);
	nextContext.__current__ = savedContext;

	return nextContext;
};

const callOperator = (context, list) => {
	const symbol = list[0].text;

	switch (symbol) {
		case "import": return defineImport(context, list);
		case "func": return defineFunction(context, list);
		case "let": return defineVariable(context, list);
		case "array": return defineArray(context, list);
		case "sys": return callSys(context, list);
		case "?": return callTernary(context, list);
	}

	if (symbol[0] === "#") return context;

	throw "Undefined operator " + list[0].text;
};

const processList = (context, list) => {
	const op = list[0];
	const args = list.slice(1, list.length);

	switch (op.token) {
		case "STRING":
		case "NUMBER": throw `Invalid token ${op.token} in the list (${op.text})`;

		case "NAME": return callFunction(context, list);
		case "OPERATOR": return callOperator(context, list);
		case "ARITHMETIC": return arithmetic(context, list);
	}

	throw "Undefined token" + op;
};

module.exports = (path) => {
	const initialContext = { __path__: path , __current__: "" };

	return tokens => executeInstructions(initialContext, tokens);
};
