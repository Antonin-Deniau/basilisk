const path = require("path"); 

let assert = require("assert");

const ast = require("../src/ast.js");
const Vm = require("../src/vm.js");

const exec = d => new Vm().run(ast(d, "<test_script>"));

describe("Operators", function() {
    describe("#let", function() {
        it("should return a string", function() {
            const expected = {
                __token__: "STRING",
                __content__: "test",
            };

            assert.deepEqual(exec("<let a <array 1 2 3>>"), expected);
        });
    });
});
