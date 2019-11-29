const path = require("path"); 

let assert = require('assert');

const ast = require("../src/ast.js");
const Vm = require("../src/vm.js");


const exec = d => new Vm(ast(d, "<test_script>")).run();

describe('Types', function() {
  describe('#array', function() {
    it('should return an array', function() {
      const expected = {
          __token__: "ARRAY",
          __content__: [
              { __token__: "NUMBER", __content__: 1 },
              { __token__: "NUMBER", __content__: 2 },
              { __token__: "STRING", __content__: "a" },
          ],
      };

      assert.deepEqual(exec('<array 1 2 "a">'), expected);
    });

    it('should return a string', function() {
      const expected = { __token__: "STRING", __content__: "test" };
      assert.deepEqual(exec('"test"'), expected);
    });

    it('should return a string', function() {
      const expected = { __token__: "NUMBER", __content__: 22 };
      assert.deepEqual(exec('22'), expected);
    });
  });
});
