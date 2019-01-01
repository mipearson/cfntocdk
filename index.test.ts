import CdkToCFN from "./index";
import fs = require("fs");
import codemaker = require("codemaker");

// const integrationExamples = ["aptly"];

const integrationExamples = ["buildkite"];

integrationExamples.forEach((stack: string) => {
  test(`our TypeScript example for ${stack} produces output that matches our CFN source`, () => {
    const cfn = JSON.parse(
      fs.readFileSync(`examples/${stack}.json`).toString()
    );
    const cdkmodule = require(`./examples/${stack}`);
    const cdkstack = new cdkmodule[`${codemaker.toPascalCase(stack)}Stack`]();

    expect(cdkstack.toCloudFormation()).toEqual(cfn);
  });

  test(`CFN source for ${stack} compiles to our TypeScript example`, () => {
    const cfn = fs.readFileSync(`examples/${stack}.json`).toString();
    const cdk = fs.readFileSync(`examples/${stack}.ts`).toString();

    const compiled = new CdkToCFN(stack, cfn).compile();

    if (compiled !== cdk) {
      fs.writeFileSync("test-compiled.ts", compiled);
    }

    expect(compiled).toEqual(cdk);
  });
});
