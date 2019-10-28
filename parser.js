// Utils
const match = (token, regex) => str => {
	const fmtRegex = `^\\s*${regex.source}\\s*`;
	let res = str.text.match(fmtRegex, 'm');
	if (res === null) return { error: true, at: str.text };

	return {
		text: str.text.substring(res[0].length, str.text.length),
		captured: [
			...str.captured,
			{ token, text: res[0].trim() },
		],
		error: false,
	};
};

const choose = array => str => {
	const choices = array.map(e => e(str)).filter(e => e.error !== true);
	if (choices.length === 0) return { error: true, at: str.text };

	return choices[0];
};

const seq = array => str => {
	let curr = str;
	for (const cb of array) {
		curr = cb(curr);
		if (curr.error === true) return curr;
	}

	return curr;
};

const loop = cb => str => {
	let curr = str;

	while (true) {
		let next = cb(curr);
		if (next.error === true) return curr;
		curr = next;
	}
};

// Simple Atoms
const string = match("STRING", /"([^"\\]|\\.)*"/);
const number = match("NUMBER", /[1-9](\d+)?(\.\d+)?/);
const name = match("NAME", /[A-z]([A-z1-9]+)?/);
const operator = match("OPERATOR", /(if|func|import|let|sys|\+|\-|\*|\/|\!|\&|#([^>\\]|\\.)*|==|\!=)/);

const atom = choose([number, string, operator, name]);

// List

const startList = match("START_LIST", /</);
const endList = match("END_LIST", />/);

const list = str => seq([
	startList,
	loop(choose([atom, list])),
	endList,
])(str);

// Ast
const tokens = loop(list);

const tokensToAST = array => {
	let captured = [];

	while (array.length !== 0) {
		let data = array.shift();

		if (data.token === "START_LIST") {
			let res = tokensToAST(array);
			captured.push(res);
		} else if (data.token === "END_LIST") {
			return captured;
		} else {
			captured.push(data);
		}
	}

	return captured;
};

const ast = data => {
	const capturedTokens = tokens({ text: data, captured: [], error: false }).captured;
	return tokensToAST(capturedTokens);
};

// Test
module.exports = data => ast(data);
