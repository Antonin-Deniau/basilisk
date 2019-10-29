const tokens = require("./parser.js");

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

module.exports = data => {
	const capturedTokens = tokens({ text: data, captured: [], error: false }).captured;
	return tokensToAST(capturedTokens);
};
