#!/usr/bin/env node

import Stack from "../lib/stack";
import fs = require("fs");

if (process.argv.length != 4) {
  throw new Error("Syntax: cdfntocdk <StackName> <input.json>");
}

process.stdout.write(
  new Stack(
    process.argv[2],
    fs.readFileSync(process.argv[3]).toString()
  ).compile()
);
