import CdkToCFN from "./index";
import fs = require("fs");
import codemaker = require("codemaker");
import testUtil = require("@aws-cdk/core/test/util");
import * as ts from "typescript";

const integrationExamples = ["buildkite", "cloudtrail", "buildkiteasg"];

for (let stack of integrationExamples) {
  const cfnSrc = `./examples/${stack}.json`;
  const tsOutput = `./examples/tmp/${stack}.ts`;
  const jsOutput = `./examples/tmp/${stack}.js`;
  const jsonOutput = `./examples/tmp/${stack}.json`;

  test(`Stack ${cfnSrc} compiles to ${tsOutput}`, () => {
    const cfn = fs.readFileSync(cfnSrc).toString();
    if (fs.existsSync(tsOutput)) fs.unlinkSync(tsOutput);

    const cdk = new CdkToCFN(stack, cfn).compile();
    fs.writeFileSync(tsOutput, cdk);

    expect(fs.readFileSync(tsOutput).toString()).toMatchSnapshot();
  });

  test(`CDK TS ${tsOutput} transpiles to CDK JS ${jsOutput}`, () => {
    if (!fs.existsSync(tsOutput)) return;
    const cdk = fs.readFileSync(tsOutput).toString();
    if (fs.existsSync(jsOutput)) fs.unlinkSync(jsOutput);

    const js = ts.transpileModule(cdk, {
      reportDiagnostics: true,
      fileName: `${stack}.ts`,
      compilerOptions: {
        target: ts.ScriptTarget.ES2015,
        module: ts.ModuleKind.CommonJS,
        strict: true,
        sourceMap: false
      }
    });
    fs.writeFileSync(jsOutput, js.outputText);
  });

  test(`CDK JS ${jsOutput} renders to CFN ${jsonOutput}`, () => {
    if (!fs.existsSync(jsOutput)) return;
    const cdkmodule = require(jsOutput);
    const cdkstack = new cdkmodule[`${codemaker.toPascalCase(stack)}Stack`]();
    const output = testUtil.toCloudFormation(cdkstack);

    fs.writeFileSync(jsonOutput, JSON.stringify(output, null, 2));
    expect(output).toMatchSnapshot();
  });
}
