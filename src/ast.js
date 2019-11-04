const tokens = require("./parser.js");

const tokensToAST = array => {
	let captured = [];

	while (array.length !== 0) {
		let data = array.shift();

		if (data.__token__ === "START_LIST") {
			let res = tokensToAST(array);
			captured.push(res);
		} else if (data.__token__ === "END_LIST") {
			return captured;
		} else {
			captured.push(data);
		}
	}

	return captured;
};

module.exports = data => {
	const result = tokens({ text: data, captured: [], error: false });
	return tokensToAST(result.captured);
};
