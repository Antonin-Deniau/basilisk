const { loop, seq, choose, match } = require("./utils/parserUtils.js");

// Simple Atoms
const string = match("STRING", /"([^"\\]|\\.)*"/);
const number = match("NUMBER", /[1-9](\d+)?(\.\d+)?/);
const name = match("NAME", /\b([_A-z]([_A-z1-9]+)?)(\.[_A-z]([_A-z1-9]+)?){0,}\b/);
const operator = match("OPERATOR", /\b(if|func|import|let|array|sys)\b/);
const arithmetic = match("ARITHMETIC", /(\+|-|\*|\||\/|\&|==|\!=|\!)/);

const atom = choose([number, string, operator, arithmetic, name]);

// List

const startList = match("START_LIST", /</);
const endList = match("END_LIST", />/);

/**
 * Function to declare a list
 * 
 * @param {string} str - The data to parse
 * @returns {ParsingResult} - The parsing result
 */
const list = str => seq([
    startList,
    loop(choose([atom, list])),
    endList,
])(str);

// Ast
module.exports = loop(choose([ atom, list ]));
