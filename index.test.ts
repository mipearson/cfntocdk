import CdkToCFN from "./index";
import fs = require("fs");

const integrationTests = ["cloudtrail"];

// test("input equals output", () => {
//   expect(new CdkToCFN().toCDK("input")).toBe("input");
// });

integrationTests.forEach((stack: string) => {
  test(`${stack}`, () => {
    const cfn = fs.readFileSync(`examples/${stack}.json`).toString();
    const cdk = fs.readFileSync(`examples/${stack}.ts`).toString();

    expect(new CdkToCFN(stack, cfn).compile()).toBe(cdk);
  });
});
