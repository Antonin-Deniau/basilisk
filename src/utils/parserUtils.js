// Utils
const match = (__token__, regex) => str => {
	const fmtRegex = `^\\s*${regex.source}\\s*`;
	let res = str.text.match(fmtRegex, 'm');
	if (res === null) return { error: true, at: str.text };

	let rest = str.rest + res[0];

	return {
		text: str.text.substring(res[0].length, str.text.length),
		rest,
		__file__: str.__file__,
		captured: [
			...str.captured,
			{
				__token__,
				__content__: res[0].trim(),
				__line__: rest.split("\n").length,
				__file__: str.__file__,
			},
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

module.exports = { loop, seq, choose, match };
