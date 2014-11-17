///////////////////
/// PARSER CORE ///
///////////////////

// a pre-populated language config is in `config.js`
function Parser(config) {
    var prio = this.priorities = config.priorities;
    prio["boundary:$"] = [-1, -1];
    this.re = config.re;
    this.toktypes = config.toktypes;
    config.blocks.forEach(function (defs) {
        var parts = defs.split(" ");
        prio[parts.shift()] = [10000, 0];
        prio[parts.pop()] = [0, 10001, true];
        parts.forEach(function (part) {prio[part] = [0, 0];});
    });
    var level = 5;
    config.tower.forEach(function (ops) {
        ops[1].split(" ").forEach(function (op) {
            var pfx = op.substring(0, 2) === "P:";
            prio[op] = [pfx ? 10000 : level, level - ops[0]];
            if (pfx && !prio[op.substring(2)])
                prio[op.substring(2)] = prio[op];
        });
        level += 5;
    });
}
// The return value of tokenize("a + 6 * 10") is:
//   [{token: "$", type: "boundary"},
//    {token: "a", type: "id"},
//    {token: "+", type: "op"},
//    {token: "6", type: "num"},
//    {token: "*", type: "op"},
//    {token: "10", type: "num"},
//    {token: "$", type: "boundary"}]
// In everything that follows, tok(a) will stand for {token: "a", type: "id"},
// tok(*) for {token: "*", type: "op"}, and so on.
Parser.prototype.tokenize = function (text) {
    var m; var last = "op";
    var results = [{token: "$", type: "boundary"}];
    while (m = this.re.exec(text)) {
        var type = this.toktypes[m.slice(1).indexOf(m[0])];
        if (type === "comment") continue;
        var tok = {token: m[0], type: type};
        // An "op" token followed by an "op" token makes the second prefix
        // unless the first is marked as suffix.
        if (last.type === "op" && type === "op" && !this.getPrio(last)[2])
            tok.prefix = true;
        results.push(tok);
        last = tok;
    }
    results.push({token: "$", type: "boundary"});
    return results;
}

Parser.prototype.getPrio = function (t) {
    // getPrio returns a pair of priorities [leftPrio, rightPrio]
    // leftPrio is used to compare with operators on the left side
    // rightPrio is used to compare with operators on the right side
    // Prefix operators can have different priority from infix ones.
    var x; var pfx = t.prefix && "P:" || "";
    if (x = this.priorities[t.type + ":" + t.token]
        ||  this.priorities[pfx + t.token]
        ||  this.priorities[t.token]
        ||  this.priorities["type:" + t.type])
        return x;
    throw SyntaxError("Unknown operator: " + t.token);
}

Parser.prototype.order = function (a, b) {
    // Compare the priorities of operators a and b when found in that order
    // To help visualize what the return value means, imagine that
    // <• and •> are matching brackets, so when you see <• you insert
    // "(" after a, and when you see •> you insert ")" before b.
    // And when you see =•, you just skip over it.
    if (a.type === "boundary" && b.type === "boundary") return "done";
    var pa = this.getPrio(a)[1];
    var pb = this.getPrio(b)[0];
    if (pa < pb)  return "<•";
    if (pa > pb)  return "•>";
    if (pa == pb) return "=•";
}

Parser.prototype.parse = function (text, finalize) {
    // This algorithm is based on operator precedence grammars:
    // http://en.wikipedia.org/wiki/Operator-precedence_grammar
    // http://dl.acm.org/citation.cfm?id=321179

    // Supposing finalize is the identity function and that we are
    // using conventional priority settings, the return value of parse
    // basically looks like this:

    // "a + b * c" ==> [tok(a), tok(+), [tok(b), tok(*), tok(c)]]
    // "a + -b"    ==> [tok(a), tok(+), [null, tok(-), tok(b)]]
    // "(a) + b"   ==> [[null, tok("("), tok(a), tok(")"), null], tok(+), tok(b)]
    // "a[b]"      ==> [tok(a), tok([), tok(b), tok(]), null]

    // EXCEPT THAT The algorithm interprets identifiers and literals
    // as nullary operators, so instead of tok(a) what you actually
    // get is [null, tok(a), null]. (Rule of thumb: even indexes
    // (0-based) are always null or a subnode, and odd indexes are
    // always tokens). To clarify:
    // "a + b" ==> [[null, tok(a), null], tok(+), [null, tok(b), null]]

    // The finalize function is given a subnode at the moment of
    // completion and should return what to replace it with. Note that
    // it's called inside out: the subnodes of what you get in
    // finalize have already been processed.

    var tokens = this.tokenize(text);
    var next = tokens.shift.bind(tokens);
    var stack = [];
    // middle points to the handle between the two operators we are
    // currently comparing (null if the two tokens are consecutive)
    var middle = null;
    var left = next();
    var right = next();
    var current = [null, left];
    while (true) {
        switch (this.order(left, right)) {
        case "done":
            // Returned when comparing boundary tokens
            return middle;
        case "<•":
            // Open new handle; it's like inserting "(" between left and middle
            stack.push(current);
            current = [middle, right];
            middle = null;
            left = right;
            right = next();
            break;
        case "•>":
            // Close current handle; it's like inserting ")" between middle and right
            // and then the newly closed (...) block becomes the new middle
            current.push(middle);
            middle = finalize(current);
            current = stack.pop()
            left = current[current.length - 1];
            break;
        case "=•":
            // Merge to current handle and keep going
            current.push(middle, right);
            middle = null;
            left = right;
            right = next();
            break;
        }
    }
}

module.exports = Parser;
