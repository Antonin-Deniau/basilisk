/** The vm error */
class VmError extends Error {
    /**
     * Instantiate the error
     *
     * @param {Stack} e - The stack of the app 
     */
    constructor(e) {
        let line = e => `\t${e.file}:${e.line}\t${e.closure}:${e.func}()`;
        super(`Error: ${e}\n${stack.map(line).join("\n")}\n`);
    }
}

module.exports = VmError;
