fourfifty
=========

Playing with push-down automaton parser and AST manipulation
I don't know who made the original jsfiddle demo. If you know, tell me and I will attribute.

- [x] Basic conversion of http://jsfiddle.net/osfnzyfd/ to Node.
- [ ] Output HTML AST diagram
- [ ] Compile to simple JS code
- [ ] Underpants
- [ ] Profit

Example of extending
--------------------
For this syntax:
```
# Fibonacci
let
    fib(n) = match n in
        0 => 0
        1 => 1
        _ => fib(n - 1) + fib(n - 2)
    end
in
    fib(10)
end
```

 Add `match in end` to blocks
```
blocks: [
        "( )", "[ ]", "{ }", "begin end", "match in end",
        "if then elif else end", "let in end"
    ],
```

Add the `=>` operator to the tower with high precedence.
```
tower: [
        [0, ", ; \n"], [1, "= each -> =>"],
        [-1, "or"], [-1, "and"], [-1, "P:not"], . . .
```

Add the responder for `match x in y end`, which then breaks down each `x => z` case and `_ => z`

```
// attempt at a pattern match syntax?
base.register(/^_ match E in E end _$/, function(node, _, v, ml, _) {
    var z = this.run(v);
    var self = this;
    var result = undefined;
    listify(ml).some(function (d) {
        var x = extractArgs("E => E", d);
        if (x[0].token == "_") {
            result = self.run(x[1]);
            return true;
        }
        var y = self.run(x[0]);
        if (y == z) {
            result = self.run(x[1]);
            return true;
        }
    });
    return result;
});
```
