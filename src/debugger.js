const readln = require("readline");
const { inspect } = require("util");

var cl = readln.createInterface( process.stdin, process.stdout );
var q = function(q) {
    return new Promise( (res, rej) => {
        cl.question( q, answer => {
            res(answer);
        })
    });
};

class Debugger {
	handleQ(qest, stack) {
		let rest = qest.substr(1, qest.length);

		switch (qest[0]) {
			case "n": 
				console.log(this.context.name);
				return stack;
			case ">": 
				let res = stack.pop();
				if (res === undefined) {
					console.log("No upper closure");
					return [];
				}

				this.context = res;
				console.log(this.context.name);
				return stack;
			case "<":
				if (this.context.prev === undefined) {
					console.log("No previous closure");
					return stack;
				}
				stack.push(this.context);
				this.context = this.context.prev;
				console.log(this.context.name);
				return stack;
			case "q":
				process.exit();
			case "=":
				try {
					if (rest === "") {
						console.log(inspect(this.context.data));
					} else {
						console.log(inspect(this.context.getVar(rest)));
					}
				} catch(e) {
					console.log(e);
				}

				return stack;
		}
		console.log("Command not found : " + qest);

		return stack;
	}

	async start(context) {
		this.context = context;

		let stack = [];

		while (true) {
			stack = this.handleQ(await q("$>"), stack);
			if (stack === undefined) break;
		}
	}
}

module.exports = Debugger;
