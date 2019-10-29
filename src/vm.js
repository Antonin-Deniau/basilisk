const fs = require("fs");
const path = require("path");

const ast = require("./ast.js");
const { setDataPath, resolveRecursive } = require("./utils/vmUtils.js");


const resolveVar = (context, variable) => {
	if (Array.isArray(variable)) {
		const nextContext = processList(context, variable);
		return nextContext.__return__;
	}

	switch (variable.token) {
		case "STRING": return JSON.parse(variable.text);
		case "NUMBER": return parseInt(variable.text);
		case "NAME":
			const data = resolveRecursive(context.namespace, context.current, variable.text, false);
			if (data) {
				return data;
			} else {
				throw "Variable not found " + variable.text;
			}
	}

	throw "Invalid variable type " + variable.token;
}

const executeInstructions = (context, list) => {
	let savedContext;
	for (const data of list) {
		if (Array.isArray(data)) {
			savedContext = context.current;
			context = processList(context, data);
			context.current = savedContext;
		} else {
			context.__return__ = resolveVar(context, data);
		}
	}

	return context;
};

const callSys = (context, list) => {
	const path = list.slice(1, list.length - 1).map(e => resolveVar(context, e));
	const args = list[list.length - 1].map(e => resolveVar(context, e));

	context.__return__ = path.reduce((acc, arr) => acc[arr], global)(...args);

	return context;
};

const defineFunction = (context, list) => {
	const name = list[1].text;
	const __args__ = list.length > 2 ? list[2] : [];
	const __instructions__ = list.slice(3, list.length);

	setDataPath(context.namespace, context.current, name, { __instructions__, __args__, __return__: null });
	return context;
};

const defineVariable = (context, list) => {
	const name = list[1].text;
	const data = list[2];

	const res = resolveVar(context, data);

	setDataPath(context.namespace, context.current, name, res);
	return context;
};

const defineImport = (context, list) => {
	const arg = JSON.parse(list[1].text).split(".");
	if (context.namespace.PATH) {
		var PATH = context.namespace.PATH;
	} else {
		throw "No path available";
	}

	for (let currPath of PATH) {
		const filePath = path.resolve(currPath, context.current, ...arg) + ".cr";

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
	const op = list[0].text;
	const data = list.slice(1, list.length).map(e => resolveVar(context, e))

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
		case "==": res = args[0] == args[1]; break;
		case "!=": res = args[0] != args[1]; break;
		case "!": res = !args[0]; break;
		default:
			throw "Undefined arithmetic" + op;
	}

	context.__return__ = res;
	return context;
};

const callFunction = (context, list) => {
	const name = list[0].text;
	context.__return__ = null;

	const ns = resolveRecursive(context.namespace, context.current, name, false);

	if (ns === false) {
		throw "Undefined function " + name;
	} else {
		const argsValue = (list.length > 1 ? list.slice(1, list.length) : [])
			.map(e => resolveVar(context, e));

		ns.__args__.forEach((name, index) => {
			setDataPath(context.namespace, context.current, name.text, argsValue[index]);
		});

		return executeInstructions(context, ns.__instructions__);
	}
};

const callOperator = (context, list) => {
	const symbol = list[0].text;

	switch (symbol) {
		case "import": return defineImport(context, list);
		case "func": return defineFunction(context, list);
		case "let": return defineVariable(context, list);
		case "sys": return callSys(context, list);
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
	const initialContext = { namespace: { PATH: path }, current: "", data: {} };

	return tokens => executeInstructions(initialContext, tokens);
};
