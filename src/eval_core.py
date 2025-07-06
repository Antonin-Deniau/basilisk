from basl_types import Fn, Name, BaslException, Keyword, Atom
from environment import Env
import types


### SYMBOLS ###
def quasiquote_process_list(ast):
    res = tuple([])
    for elt in reversed(ast):
        if (
            isinstance(elt, tuple)
            and len(elt) != 0
            and isinstance(elt[0], Name)
            and elt[0].name == "splice-unquote"
        ):
            res = tuple([Name("concat"), elt[1], res])
        else:
            res = tuple([Name("cons"), quasiquote(elt), res])

    return res


def quasiquote(ast):
    if isinstance(ast, tuple):
        if len(ast) != 0 and isinstance(ast[0], Name):
            if isinstance(ast[0], Name) and ast[0].name == "unquote":
                return ast[1]
        return quasiquote_process_list(ast)

    if isinstance(ast, list):
        return tuple([Name("vec"), quasiquote_process_list(tuple(ast))])

    if isinstance(ast, dict) or isinstance(ast, Name):
        return tuple([Name("quote"), ast])

    return ast


def is_macro_call(ast, env):
    if isinstance(ast, tuple) and isinstance(ast[0], Name):
        try:
            return env.get(ast[0].name).is_macro
        except:
            return False
    else:
        return False


def macroexpand(ast, env):
    while is_macro_call(ast, env):
        fnc = env.get(ast[0].name)
        ast = fnc.fn(*ast[1:])

    return ast


### EVAL PART ###
def evl(ast, env):
    while True:
        if isinstance(ast, tuple):
            if len(ast) == 0:
                return ast

            ast = macroexpand(ast, env)
            if not isinstance(ast, tuple):
                return eval_ast(ast, env)

            if isinstance(ast[0], Name):
                if ast[0].name == "def!":
                    value = evl(ast[2], env)
                    return env.set(ast[1].name, value)

                if ast[0].name == "defmacro!":
                    value = evl(ast[2], env)
                    value.is_macro = True
                    return env.set(ast[1].name, value)

                if ast[0].name == "let*":
                    new_env = Env(env, [], [])
                    binding_list = ast[1]

                    for i in zip(binding_list[::2], binding_list[1::2]):
                        data = evl(i[1], new_env)
                        new_env.set(i[0], data)

                    ast, env = ast[2], new_env
                    continue

                if ast[0].name == "try*":
                    if len(ast) < 3:
                        return evl(ast[1], env)

                    try:
                        return evl(ast[1], env)
                    except BaslException as e:
                        new_env = Env(env, [ast[2][1].name], [e])
                        return evl(ast[2][2], new_env)
                    except Exception as e:
                        new_env = Env(env, [ast[2][1].name], [str(e)])
                        return evl(ast[2][2], new_env)

                if ast[0].name == "quote":
                    return ast[1]

                if ast[0].name == "macroexpand":
                    return macroexpand(ast[1], env)

                if ast[0].name == "quasiquoteexpand":
                    return quasiquote(ast[1])

                if ast[0].name == "quasiquote":
                    ast = quasiquote(ast[1])
                    continue

                if ast[0].name == "do":
                    res = None
                    for x in ast[1:-1]:
                        res = evl(x, env)
                    ast = ast[-1]
                    continue

                if ast[0].name == "if":
                    if len(ast) < 3:
                        ast, env = None, env
                        continue
                    res_cond = evl(ast[1], env)

                    if type(res_cond) == bool and res_cond == True:
                        ast = ast[2]
                        continue
                    if type(res_cond) == int:
                        ast = ast[2]
                        continue
                    if type(res_cond) == float:
                        ast = ast[2]
                        continue
                    if type(res_cond) == list:
                        ast = ast[2]
                        continue
                    if type(res_cond) == tuple:
                        ast = ast[2]
                        continue
                    if type(res_cond) == str:
                        ast = ast[2]
                        continue
                    if type(res_cond) == Fn:
                        ast = ast[2]
                        continue
                    if type(res_cond) == Keyword:
                        ast = ast[2]
                        continue
                    if type(res_cond) == Name:
                        ast = ast[2]
                        continue
                    if type(res_cond) == types.LambdaType:
                        ast = ast[2]
                        continue
                    if type(res_cond) == Atom:
                        ast = ast[2]
                        continue

                    ast = ast[3] if len(ast) >= 4 else None
                    continue

                if ast[0].name == "fn*":
                    body = ast[2]
                    params = ast[1]

                    func = lambda *e: evl(body, Env(env, params, e))
                    return Fn(body, params, env, func)

            [f, *args] = eval_ast(ast, env)

            if isinstance(f, Fn):
                ast, env = f.ast, Env(f.env, f.params, args)
                continue

            if isinstance(f, types.LambdaType):
                return f(*args)

        return eval_ast(ast, env)


def eval_ast(ast, env):
    if isinstance(ast, dict):
        return {k: evl(v, env) for k, v in ast.items()}

    if isinstance(ast, Name):
        return env.get(ast.name)

    if isinstance(ast, list):
        return list([evl(a, env) for a in ast])

    if isinstance(ast, tuple):
        return tuple([evl(x, env) for x in ast])

    return ast
