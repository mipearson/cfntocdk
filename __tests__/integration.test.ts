import Stack from "../lib/stack";
import fs = require("fs");
import { SynthUtils } from "@aws-cdk/assert";

import * as ts from "typescript";
import { toPascal } from "../lib/util";
import path = require("path");

const integrationExamples = ["WordPress_Multi_AZ", "buildkite"];

for (let stack of integrationExamples) {
  const cfnSrc = `./__fixtures__/${stack}.json`;
  const tsOutput = `./tmp/${stack}.ts`;
  const jsOutput = `./tmp/${stack}.js`;
  const jsonOutput = `./tmp/${stack}.json`;

  test(`Fixture ${cfnSrc} -> CDK TypeScript -> Javascript -> JSON === Fixture`, () => {
    const cfn = fs.readFileSync(cfnSrc).toString();

    // Remove temporary output from our previous run
    [tsOutput, jsOutput, jsonOutput].forEach((filename) => {
      if (fs.existsSync(filename)) fs.unlinkSync(filename);
    });

    // Compile our CFN to CDK TS
    const cdk = new Stack(stack, cfn).compile();
    fs.writeFileSync(tsOutput, cdk);

    // Transpile TS to JS, without type checks
    const js = ts.transpileModule(cdk, {
      reportDiagnostics: true,
      fileName: `${stack}.ts`,
      compilerOptions: {
        target: ts.ScriptTarget.ES2015,
        module: ts.ModuleKind.CommonJS,
        strict: true,
        sourceMap: false,
      },
    });
    fs.writeFileSync(jsOutput, js.outputText);

    // Load our JS, then synthesise a stack
    const cdkmodule = require(path.join(process.cwd(), jsOutput));
    const cdkstack = new cdkmodule[`${toPascal(stack)}Stack`]();
    const output = SynthUtils.toCloudFormation(cdkstack);
    fs.writeFileSync(jsonOutput, JSON.stringify(output, null, 2));

    // Assert that what we just synthesised matched what we imported
    expect(output).toEqual(JSON.parse(cfn));
  });

  test(`${tsOutput} matches snapshot`, () => {
    // Seperate from the above test case as it's useful to see what's changed
    // in the generated TypeScript without relying on a passing or failing
    // comparison with the original.
    expect(fs.readFileSync(tsOutput).toString()).toMatchSnapshot();
  });
}
