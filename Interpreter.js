// Javascript runtime hosted interpreter

////////////////////////
/// INTERPRETER CORE ///
////////////////////////

function Env(parent) {
    this.parent = parent;
    // I use JS's prototype inheritance to implement looking up
    // bindings in the parent scope.
    this.bindings = parent ? Object.create(parent.bindings) : {};
    this.macros = parent ? parent.macros : [];
};

Env.prototype.resolve = function (sym) {
    var res = this.bindings[sym];
    // We must avoid resolving default fields of objects like toString
    if (res !== {}[sym]) return res
    else throw Error("Could not resolve symbol: " + sym);
};

Env.prototype.register = function (guard, handler) {
    this.macros.push({guard: guard, handler: handler});
};

Env.prototype.getHandler = function (signature) {
    // signature is a string like "E + E" or "E ( E ) _" that
    // describes the kind of node we're trying to handle. E stands for
    // an expression whereas _ means there is nothing there.
    // Handlers either match the exact string or a regular expression
    for (var i = 0; i < this.macros.length; i++) {
        var m = this.macros[i];
        if (m.guard instanceof RegExp && signature.match(m.guard)
            || m.guard === signature)
            return m.handler;
    }
    throw Error("Unknown signature: " + signature);
};

Env.prototype.run = function(node) {
    switch (node.type) {
    case "op":
    case "id":  return this.resolve(node.token);
    case "num": return parseInt(node.token);
    case "str": return node.token.substring(1, node.token.length - 1).replace('\\"', '"');
    case "inner":
        // Handler for the node's signature is called with the node as
        // its first argument and the node's actual arguments as its
        // second, ... arguments. For instance, the handler for "a + b"
        // would be called as handler.call(this, node, a, b).
        return this.getHandler(node.signature).apply(this, [node].concat(node.args));
    default:
        throw SyntaxError("Unknown leaf type: " + node.type);
    }
};

function finalize(node) {
    // This is given to Parser::parse as a callback. It reformats the
    // parser's output to be a bit easier to manipulate.
    // a + b ==> [[null, tok(a), null], tok(+), [null, tok(b), null]] (parser)
    //       ==> {type: "inner", args: [tok(a), tok(b)], signature: "E + E"} (finalize)
    if (node.length === 3 && node[0] === null && node[2] === null)
        return node[1];
    return {type: "inner",
            orig: node,
            args: node.filter(function (x, i) { return i % 2 == 0; }),
            signature: node.map(function (x, i) {
                if (i % 2 == 0)
                    return x === null ? "_" : "E"
                else 
                    return x.token
            }).join(" ")};
}

///////////////////
/// INTERPRETER ///
///////////////////

var base = new Env();

function applyCall(env, fargs) {
    var fn = env.run(fargs[0]);
    return fn.apply(null, fargs[1].map(function (arg) {
        if (fn.lazy) return function () {return env.run(arg);};
        else         return env.run(arg);
    }));
}

function makeFunction(env, argnames, body) {
    return function () {
        var args = arguments;
        var e = new Env(env);
        argnames.forEach(function (n, i) {
            e.bindings[n.token] = args[i];
        });
        return e.run(body);
    };
}

function extractArgs(guard, node, strict) {
    // This checks that the node has a certain form and returns a list
    // of its non-null arguments. For instance,
    // extractArgs("E + E", node) will check that node is an addition
    // and will return a list of its two operands. If it is not an
    // addition, it returns null or throws an error depending on the
    // value of strict.
    if (node && (node.signature
                 && guard instanceof RegExp
                 && node.signature.match(guard)
                 || guard === node.signature))
        return node.args.filter(function (x) { return x !== null; });
    if (strict)
        throw Error("Expected '"+guard+"' but got '"+node.signature+"'");
    return null;
}

function listify(node) {
    // Basically if given "a, b, c" this returns [a, b, c], and given
    // "a" this returns [a]. It's a kind of normalization, really.
    return extractArgs(/^[E_]( [;,\n] [E_])+$/, node) || (node ? [node] : []);
}

function normalizeCall(node) {
    // Given either "a + b" or "(+)(a, b)" this returns [+, [a, b]].
    var args;
    if (args = extractArgs(/^[E_] [^ ]+ [E_]$/, node))
        return [node.orig[1], args];
    else if (args = extractArgs(/^E \( [E_] \) _$/, node))
        return [args[0], listify(args[1])];
    return null;
}

function normalizeAssignment(node) {
    // Given "a = b" this returns [a, null, b]
    // Given "f(a) = b" this returns [f, [a], b]
    var lr = extractArgs("E = E", node, true);
    var fargs;
    if (fargs = normalizeCall(lr[0])) return [fargs[0], fargs[1], lr[1]];
    else return [lr[0], null, lr[1]];
}

// The language's basic features follow. I think they are mostly
// straightforward.

base.register(/^[E_]( [;,\n] [E_])+$/, function (node) {
    var self = this;
    return listify(node).map(function (arg) { return self.run(arg); }).pop();
});

base.register("_ ( E ) _", function (node, _, x, _) { return this.run(x); });
base.register("_ begin E end _", function(node, _, x, _) {return this.run(x);});
base.register(/^E \( [E_] \) _$/, function (node, f, x, _) {
    return applyCall(this, normalizeCall(node));
});

// [a, b, ...] defines a list
base.register("_ [ E ] _", function (node, _, x, _) {
    var self = this;
    return listify(x).map(function (x) { return self.run(x); });
});
// a[b] indexes a list; notice the E before the [, unlike above
base.register("E [ E ] _", function (node, l, x, _) {
    return this.run(l)[this.run(x)];
});

base.register(/^_ if E then E( elif E then E)* else E end _$/,
    function (node) {
        var args = [].slice.call(arguments, 2, -1);
        for (var i = 0; i < args.length - 1; i += 2) {
            if (this.run(args[i])) return this.run(args[i + 1]);
        }
        return this.run(args[i]);
    });

base.register("_ let E in E end _", function (node, _, defn, body, _) {
    var e = new Env(this);
    listify(defn).forEach(function (d) {
        var args = normalizeAssignment(d);
        if (args[1])
            e.bindings[args[0].token] = makeFunction(e, args[1], args[2]);
        else
            e.bindings[args[0].token] = e.run(args[2]);
    });
    return e.run(body);
});

base.register("E -> E", function (node, defn, body) {
    var argnames = listify((extractArgs("_ ( E ) _", defn) || [defn])[0]);
    return makeFunction(this, argnames, body);
});

base.register("E each E", function (node, lst, op) {
    return this.run(lst).map(this.run(op));
});

// Default fallback for unknown binary operators
base.register(/^[E_] [^ ()\[\]\{\}]+ [E_]$/, function (node) {
    return applyCall(this, normalizeCall(node));
});

function lazy(f) { f.lazy = true; return f; }
// These are the global bindings of the language.
base.bindings = {
    "+":  function (x, y) { return x + y; },
    "-":  function (x, y) { return y === undefined ? -x : x - y; },
    "*":  function (x, y) { return x * y; },
    "/":  function (x, y) { return x / y; },
    "^":  Math.pow,
    "==": function (x, y) { return x == y; },
    "!=": function (x, y) { return x != y; },
    "<":  function (x, y) { return x < y; },
    "<=": function (x, y) { return x <= y; },
    ">":  function (x, y) { return x > y; },
    ">=": function (x, y) { return x >= y; },
    "..": function (start, end) {
        return Array.apply(null, Array(end - start)).map(function (_, i) {
            return i + start;
        });
    },
    and:  lazy(function (x, y) { return x() && y(); }),
    or:   lazy(function (x, y) { return x() || y(); }),
    not:  function (x) { return !x; },
    log:  Math.log,
    sin:  Math.sin,
    cos:  Math.cos,
    tan:  Math.tan,
    true: true,
    false: false
}

function exec(s, parser) {
    var tree = parser.parse(s, finalize);
    var e = new Env(base);
    return e.run(tree);
}


exports.core = Env;
exports.exec = exec;
