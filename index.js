var config = require('./config.js');
var Parser = require('./Parser.js');

/*console.log("Config")
console.dir(config);
console.log("Parser")
console.dir(new Parser(config));
*/

var sample = "10 + 5 * 7 - 2^3^2";
var parser = new Parser(config);

var outp = parser.parse(sample, inspect);

console.log("###" + outp);

function inspect(node) {
    console.dir(node);
}

