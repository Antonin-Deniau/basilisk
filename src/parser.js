const { loop, seq, choose, match } = require("./utils/parserUtils.js");

// Simple Atoms
const string = match("STRING", /"([^"\\]|\\.)*"/);
const number = match("NUMBER", /[1-9](\d+)?(\.\d+)?/);
const name = match("NAME", /\b([_A-z]([_A-z1-9]+)?)(\.[_A-z]([_A-z1-9]+)?){0,}\b/);
const operator = match("OPERATOR", /(\?|\bfunc\b|\bfilter\b|map\b|\bjoin\b|\bpipe\b|\bimport\b|\blet\b|\barray\b|\bsys\b|#([^>\\]|\\.)*)/);
const arithmetic = match("ARITHMETIC", /(\+|-|\*|\||\/|\&|==|\!=|\!)/);

const atom = choose([number, string, operator, arithmetic, name]);

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
