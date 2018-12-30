import { JSONMap } from "./types";
import codemaker = require("codemaker");

interface FoundKey {
  name: string;
  value: any;
}

export default class Options {
  data: JSONMap;
  references: Array<string>;
  compiled: string;

  private insideFunction = false;

  constructor(data: JSONMap | undefined) {
    this.data = data ? data : {};
    this.references = [];
    this.compiled = this.render(this.data);
  }

  compile(): string {
    return this.compiled;
  }

  render(data: JSONMap): string {
    this.insideFunction = false;
    return this.renderInner(data);
  }

  private findFnKey(data: any): FoundKey | null {
    const fnFunc = Object.keys(data).find(
      k => k.startsWith("Fn::") || k.startsWith("!")
    );
    if (!fnFunc) {
      return null;
    }

    return {
      name: fnFunc.replace(/^(Fn::|!)/, ""),
      value: data[fnFunc]
    };
  }

  private renderInner(data: any): string {
    if (data === null) {
      return "new cdk.AwsNoValue()";
    }

    if (data instanceof Array) {
      const items = data.map(i => this.renderInner(i));
      return `[ ${items.join(",\n")} ]`;
    }

    if (data instanceof Object) {
      if (data.Ref) {
        if (data.Ref === "AWS::NoValue") {
          return "new cdk.AwsNoValue()";
        }
        this.references.push(data.Ref);
        return `${codemaker.toCamelCase(data.Ref)}.ref`;
      }

      const fnKey = this.findFnKey(data);

      if (fnKey) {
        const value =
          fnKey.value instanceof Array ? fnKey.value : [fnKey.value];

        this.insideFunction = true;
        const items = value.map(i => this.renderInner(i)).join(", ");
        this.insideFunction = false;

        return `new cdk.Fn${fnKey.name}(${items})`;
      }

      const items = Object.keys(data).map(
        k =>
          `${
            this.insideFunction ? k : codemaker.toCamelCase(k)
          }: ${this.renderInner(data[k])}`
      );
      return `{ ${items.join(",\n")} }`;
    }

    return JSON.stringify(data);
  }
}
