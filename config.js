/////////////////////////////////////////////////////////////////
/// GRAMMAR - the config and regexes that define the language ///
/////////////////////////////////////////////////////////////////

var op_re = "([\\(\\)\\[\\]\\{\\},;\n]|[!@$%^&*|/?.:~+=<>-]+)"
var id_re = "([A-Za-z_][A-Za-z_0-9]*)"
var num_re = "([0-9]+)"
var str_re = "(\"(?:[^\"]|\\\\.)*\")"
var cmnt_re = "(#.*(?:$|(?=\n)))"
var re = new RegExp([op_re, id_re, num_re, str_re, cmnt_re, "([^ ])"].join("|"), "g");
var toktypes = ["op", "id", "num", "str", "comment", "other"];

var config = {
    // This is the regular expression to tokenize with. Each group of
    // the regexp corresponds to a token type.
    re: re,

    // These are the token types for each group in the regexp.
    toktypes: toktypes,

    // These are individual priority settings for a set of operators.
    // id, num and str are to be treated as nullary, which means
    // giving them maximal priority on each side. The first priority
    // is when the operator is compared with another on its left, the
    // second is for comparison with an operator on its right.
    priorities: {
        "boundary:$":    [-1,   -1],     // unused
        "type:id":       [20001, 20000],
        "type:num":      [20001, 20000],
        "type:str":      [20001, 20000],
    },

    // These are all treated as bracket types. The operators between
    // the first and last are "middle" operators. Essentially, given
    // these definitions, "let in end" will assign the following
    // priorities: {let: [10000, 0], in: [0, 0], end: [0, 10001]}.
    // For "let x in y end" the parser will thus output:
    // [null, tok(let), tok(x), tok(in), tok(y), tok(end), null]
    // An operator can only have one role, so none of the operators
    // specified here should be in the tower.
    blocks: [
        "( )", "[ ]", "{ }", "begin end",
        "if then elif else end", "let in end"
    ],

    // [-1, "P:- * /"] means that prefix - and infix * and /
    //     have the same priority and are left associative.
    //     This translates to priority [p, p + 1].
    // [1, "^"] means that infix ^ is right associative
    //     This translates to priority [p, p - 1].
    // [0, ", ; \n"] means that , ; and \n are list associative
    //     This translates to priority [p, p].
    // The groups are listed from *lowest* to *highest* priority
    tower: [
        [0, ", ; \n"], [1, "= each ->"],
        [-1, "or"], [-1, "and"], [-1, "P:not"],
        [-1, "== != < <= >= >"], [-1, ".."],
        [-1, "+ -"], [-1, "P:- * /"], [1, "^"],
        [-1, "type:op"] // everything else
    ]
}

module.exports = config;

