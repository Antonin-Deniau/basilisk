const readln = require("readline");
const { inspect } = require("util");

let q = function(q) {
	let cl = readln.createInterface(process.stdin, process.stdout);

	return new Promise((res, rej) => {
		cl.question(q, answer => {
			cl.close();
			res(answer);
		})
	});
};

class Debugger {
	async start(context) {
		this.context = context;

		let stack = [];

		while (true) {
			let output = await q("$>");

			let key = output[0];
			let value = output.substr(1, output.length);

			switch (key) {
				case "n": 
					console.log(this.context.name);
					continue;
				case ">": 
					let res = stack.pop();
					if (res === undefined) {
						console.log("No upper closure");
						stack = [];
						continue;
					}

					this.context = res;
					console.log(this.context.name);
				case "c":
					console.log("resume...");
					return;
				case "<":
					if (this.context.prev === undefined) {
						console.log("No previous closure");
						continue;
					}
					stack.push(this.context);
					this.context = this.context.prev;
					console.log(this.context.name);
					continue;
				case "q":
					process.exit();
				case "=":
					try {
						if (value === "") {
							console.log(inspect(this.context.data));
						} else {
							console.log(inspect(this.context.getVar(value)));
						}
					} catch(e) {
						console.log(e);
					}
					continue;
				default:
					console.log("Command not found : " + output);
					continue;
			}
		}
	}
}

module.exports = Debugger;
