/* eslint-disable require-jsdoc */
/* eslint-disable semi */

function validateList(list) {
    if (list.length === 0) throw "Empty list" + list;

    if (Array.isArray(list[0])) {

    }

    switch (list[0].__token__) {
        case ""
    }

}

function validateAst(ast) {
    validateList(ast);
}

module.exports = validateAst;
