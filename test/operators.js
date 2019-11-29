const path = require("path"); 

let assert = require('assert');

const ast = require("../src/ast.js");
const Vm = require("../src/vm.js");


const exec = d => new Vm(ast(d, "<test_script>")).run();

describe('Operators', function() {
  describe('#let', function() {
    it('should return a string', function() {
      const expected = { __token__: "STRING", __content__: "test" };

      assert.deepEqual(exec('"test"'), expected);
    });
  });
});
