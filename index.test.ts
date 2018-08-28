import CdkToCFN from "./index";
import fs = require("fs");
import { firstUpper } from "./lib/util";

const integrationExamples = ["cloudtrail"];

integrationExamples.forEach((stack: string) => {
  test(`our TypeScript example for ${stack} produces output that matches our CFN source`, () => {
    const cfn = JSON.parse(
      fs.readFileSync(`examples/${stack}.json`).toString()
    );
    const cdkmodule = require(`./examples/${stack}`);
    const cdkstack = new cdkmodule[`${firstUpper(stack)}Stack`]();

    expect(cdkstack.toCloudFormation()).toEqual(cfn);
  });

  test(`CFN source for ${stack} compiles to our TypeScript example`, () => {
    const cfn = fs.readFileSync(`examples/${stack}.json`).toString();
    const cdk = fs.readFileSync(`examples/${stack}.ts`).toString();

    expect(new CdkToCFN(stack, cfn).compile()).toEqual(cdk);
  });
});
