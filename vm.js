
// Context utils
const resolveRecursive = (object, initPath, name, defaultValue) => {
	let path = initPath.split(".").filter(e => "" !== e);

	let res;
	do {
		let res = resolvePath(object, [...path, name].join("."), false);
		if (res !== false) return res;

		path.shift();
	} while (path.length !== 0);

	throw "Cannot find variable " + name;
};

const concatPath = (a, ...b) => a === "" ? b.join(".") : [a, ...b].join(".");

const resolvePath = (object, path, defaultValue) => path
   .split('.').filter(e => e !== "")
   .reduce((o, p) => o && o[p] ? o[p] : defaultValue, object)

const setPath = (object, path, value) => path
   .split('.').filter(e => e !== "")
   .reduce((o,p,i) => o[p] = path.split('.').length === ++i ? value : o[p] || {}, object)

const setDataPath = (object, path, name, value) => setPath(object, concatPath(path, name), value);

// VM

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
		throw "Unable to get namespace " + context.current;
	}

	if (ns !== false) {
		const argsValue = (list.length > 1 ? list.slice(1, list.length) : []).map(e => resolveVar(context, e));

		ns.__args__.forEach((name, index) => {
			setDataPath(context.namespace, context.current, name.text, argsValue[index]);
		});

		return executeInstructions(context, ns.__instructions__);
	} else {
		throw "Undefined function " + name;
	}
};

const callOperator = (context, list) => {
	switch (list[0].text) {
		case "func": return defineFunction(context, list);
		case "let": return defineVariable(context, list);
		case "sys": return callSys(context, list);
		case "*": case "+": case "-": case "/":
			return arithmetic(context, list);
	}

	if (list[0].text[0] === "#") return context;

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
	}

	throw "Undefined token" + op;
};

module.exports = (path) => {
	const initialContext = { namespace: { PATH: path }, current: "", data: {} };

	return tokens => executeInstructions(initialContext, tokens);
};
