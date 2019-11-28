const readln = require("readline");
const { inspect } = require("util");

let q = function(q) {
    let cl = readln.createInterface(process.stdin, process.stdout);

    return new Promise((res, rej) => {
        cl.question(q, answer => {
            cl.close();
            res(answer);
        });
    });
};

class Debugger {
    async start(context) {
        console.log(context.name);

        let stack = [];

        while (true) {
            let output = await q("$>");

            let key = output[0];
            let value = output.substr(1, output.length);

            switch (key) {
            case "n": 
                console.log(context.name);
                continue;
            case ">": 
                let res = stack.pop();
                if (res === undefined) {
                    console.log("No upper closure");
                    stack = [];
                    continue;
                }

                this.context = res;
                console.log(context.name);
            case "c":
                console.log("resume...");
                return;
            case "<":
                if (context.prev === undefined) {
                    console.log("No previous closure");
                    continue;
                }
                stack.push(context);
                context = context.prev;
                console.log(context.name);
                continue;
            case "q":
                process.exit();
            case "=":
                try {
                    if (value === "") {
                        console.log(inspect(context.data));
                    } else {
                        console.log(inspect(context.getVar(value)));
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
