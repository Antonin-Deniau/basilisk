const { loop, seq, choose, match } = require("./utils/parserUtils.js");

// Simple Atoms
const string = match("STRING", /"([^"\\]|\\.)*"/);
const number = match("NUMBER", /[1-9](\d+)?(\.\d+)?/);
const name = match("NAME", /([_A-z]([_A-z1-9]+)?)(\.[_A-z]([_A-z1-9]+)?){0,}/);
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
module.exports = loop(list);
