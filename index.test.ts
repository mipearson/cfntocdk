import CdkToCFN from "./index";

test("input equals output", () => {
  expect(new CdkToCFN().toCDK("input")).toBe("input");
});
