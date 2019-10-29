const fs = require("fs");
const path = require("path");

const ast = require("./ast.js");
const { setDataPath, resolveRecursive, concatPath } = require("./utils/vmUtils.js");


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
	const path = list.slice(1, list.length - 1).map(e => resolveVar(context, e).__return__);
	const args = list[list.length - 1].map(e => resolveVar(context, e).__return__);

	context.__return__ = path.reduce((acc, arr) => acc[arr], global)(...args);

	return context;
};

const defineFunction = (context, list) => {
	const name = list[1].text;
	const __args__ = list.length > 2 ? list[2] : [];
	const __instructions__ = list.slice(3, list.length);

	setDataPath(context, context.__current__, name, { __instructions__, __args__, __return__: null });
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
	const op = list[0].text;
	const data = list.slice(1, list.length).map(e => resolveVar(context, e).__return__)

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
	const name = list[0].text;
	context.__return__ = null;


	const ns = resolveRecursive(context, context.__current__, name, false);

	if (ns === false) {
		throw "Undefined function " + name;
	} else {
		const argsValue = (list.length > 1 ? list.slice(1, list.length) : [])
			.map(e => resolveVar(context, e).__return__);

		let savedContext = context.__current__;
		context.__current__ = concatPath(context.__current__, name);

		ns.__args__.forEach((name, index) => {
			setDataPath(context, context.__current__, name.text, argsValue[index]);
		});

		let nextContext = executeInstructions(context, ns.__instructions__);
		nextContext.__current__ = savedContext;

		return nextContext;
	}
};

const callOperator = (context, list) => {
	const symbol = list[0].text;

	switch (symbol) {
		case "import": return defineImport(context, list);
		case "func": return defineFunction(context, list);
		case "let": return defineVariable(context, list);
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
