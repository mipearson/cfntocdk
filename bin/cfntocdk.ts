import Stack from "../lib/stack";
import fs = require("fs");

if (process.argv.length != 3) {
  throw new Error("Syntax: cdfntocdk <StackName> <input.json>");
}

console.log(
  new Stack(
    process.argv[2],
    fs.readFileSync(process.argv[3]).toString()
  ).compile()
);
