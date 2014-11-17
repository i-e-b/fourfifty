var config = require('./config.js');
var Parser = require('./Parser.js');
var interp = require('./Interpreter.js').exec;

/*console.log("Config")
console.dir(config);
console.log("Parser")
console.dir(new Parser(config));
*/

var sample = "let square(x) = x * x\n"
           + "    odd(x) = if x == 0 then false else even(x - 1) end\n"
           + "    even(x) = if x == 0 then true else odd(x - 1) end\n"
           + "in\n"
           + "    [1, 2, 3, 4, 5] each x -> begin\n"
           + "        [square(x), even(x)]\n"
           + "    end\n"
           + "end\n"
//var sample = "10 + 5 * 7 - 2^3^2";
var parser = new Parser(config);

var outp = interp(sample, parser);
    //parser.parse(sample, inspect);


console.log("INPUT:\n"+sample+"\n\nOUTPUT:\n" + outp);

function inspect(node) {
    console.dir(node);
}

