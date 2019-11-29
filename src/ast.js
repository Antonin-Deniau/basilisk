const tokens = require("./parser.js");

const tokensToAST = (array, file) => {
    let captured = [];

    while (array.length !== 0) {
        let data = array.shift();

        if (data.__token__ === "STRING") {
            data.__content__ = JSON.parse(data.__content__);
        }

        if (data.__token__ === "NUMBER") {
            data.__content__ = JSON.parse(data.__content__);
        }

        if (data.__token__ === "OPERATOR") {
            data.__file__ = file;
        }

        if (data.__token__ === "START_LIST") {
            let res = tokensToAST(array);
            captured.push(res);
        } else if (data.__token__ === "END_LIST") {
            return captured;
        } else {
            let { __token__, __content__ } = data;
            captured.push({ __token__, __content__ });
        }
    }

    return captured;
};

module.exports = (data, file) => {
    const result = tokens({ text: data, rest: "", captured: [], error: false });
    return tokensToAST(result.captured, file);
};
