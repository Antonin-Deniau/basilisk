#!/usr/bin/env python
import types, sys
from lark import Lark, Transformer
from basl_types import Name, Keyword, Fn, Atom, BaslException

rules = r"""
?start: obj

?obj: list
    | metadata
    | deref
    | hashmap
    | vector
    | keyword
    | quote
    | quasiquote
    | spliceunquote
    | unquote
    | COMMA
    | TOKEN -> name
    | COMMENT
    | NUM -> number
    | BOOLEAN -> boolean
    | string
    | variadic
    | NIL -> nil

list: "(" obj* ")"
metadata: "^" obj obj
deref: "@" obj
hashmap: "{" ((keyword|string) obj)* "}"
vector: "[" obj* "]"
keyword: ":" TOKEN
quote: "'" obj
quasiquote: "`" obj
unquote: "~" obj
spliceunquote: "~@" obj
string: ESCAPED_STRING
variadic: "&"

NIL.5: /nil(?!\?)/
BOOLEAN.5: /(true|false)(?!\?)/
NUM.5: "-"?NUMBER

COMMENT: /;.*(?=(\n|$))/
COMMA: ","

TOKEN: /[^"^.@~`\[\]:{}&'0-9\s,();][^"^@~`\[\]:{}\s();]*/

ESCAPED_STRING: /"(\\.|[^"\\])*"/

%import common.NUMBER
%import common.WS
%ignore WS
%ignore COMMENT
%ignore COMMA
"""

l = Lark(rules, parser="lalr", start="start")


def unescape(s):
    res = ""
    esc = False
    for i in s:
        if i == "\\" and esc == False:
            esc = True
        elif i == "\\" and esc == True:
            res += "\\"
            esc = False
        elif i == "n" and esc == True:
            res += "\n"
            esc = False
        elif i == '"' and esc == True:
            res += '"'
            esc = False
        else:
            res += i
            esc = False

    return res


def escape(s):
    res = ""
    for i in s:
        if i == "\\":
            res += "\\\\"
        elif i == '"':
            res += '\\"'
        elif i == "\n":
            res += "\\n"
        else:
            res += i

    return res


def pr_str(x, readably):
    return escape(x) if readably else x


class ToAst(Transformer):
    start = lambda _, x: x[0] if len(x) else None
    list = tuple
    vector = lambda _, x: list(x)

    nil = lambda _, x: None
    variadic = lambda _, x: Name("&")
    number = lambda _, x: (
        float(x[0].value) if x[0].value.find(".") != -1 else int(x[0].value)
    )
    boolean = lambda _, x: x[0] == "true"
    name = lambda _, x: Name(x[0].value)
    string = lambda _, x: unescape(x[0][1:-1])
    deref = lambda _, x: tuple([Name("deref"), *x])
    metadata = lambda _, x: tuple([Name("with-meta"), x[1], x[0]])
    hashmap = lambda _, x: {i[0]: i[1] for i in zip(list(x[::2]), list(x[1::2]))}
    keyword = lambda _, x: Keyword(x[0].value)
    quote = lambda _, x: tuple([Name("quote"), *x])
    quasiquote = lambda _, x: tuple([Name("quasiquote"), *x])
    unquote = lambda _, x: tuple([Name("unquote"), *x])
    spliceunquote = lambda _, x: tuple([Name("splice-unquote"), *x])


def display(x, readably):
    if isinstance(x, bool):
        return "true" if x is True else "false"

    if isinstance(x, types.LambdaType):
        return "#<function>"

    if isinstance(x, Fn):
        return "#<function>"

    if isinstance(x, tuple):
        return "({})".format(" ".join([display(r, readably) for r in x]))

    if isinstance(x, int):
        return repr(x)

    if isinstance(x, float):
        return repr(x)

    if isinstance(x, str):
        return '"{}"'.format(pr_str(x, readably)) if readably else x

    if isinstance(x, list):
        return "[{}]".format(" ".join([display(s, readably) for s in x]))

    if isinstance(x, dict):
        return "{{{}}}".format(
            " ".join(
                [
                    "{} {}".format(display(k, readably), display(v, readably))
                    for k, v in x.items()
                ]
            )
        )

    if isinstance(x, Keyword):
        return ":{}".format(x.name)

    if isinstance(x, BaslException):
        return display(x.message, readably)

    if isinstance(x, Name):
        return x.name

    if isinstance(x, Atom):
        return "(atom {})".format(display(x.data, readably))

    if x is None:
        return "nil"

    return x


def parse(data):
    tree = l.parse(data)
    return ToAst().transform(tree)


def prnt(e):
    sys.stdout.write(display(e, True))
    sys.stdout.write("\n")


if __name__ == "__main__":
    while True:
        try:
            res = prnt(parse(input("basilisk> ")))
            print(res if res != None else "nil")
        except Exception as e:
            print("EOF: {}".format(e))
