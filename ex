#!/usr/bin/env node

const fs = require("fs"); 
const path = require("path"); 

const ast = require("./parser.js");
const createVm = require("./vm.js");


try {
	const arg = process.argv.slice(2);
	const scriptPath = path.resolve(process.cwd(), ...arg);

	const data = fs.readFileSync(scriptPath, 'utf8');
	const vm = createVm([path.dirname(scriptPath)]);

	vm(ast(data));
} catch (err) {
	console.error(err)
}
