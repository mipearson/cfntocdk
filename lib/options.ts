import { JSONMap } from "./types";
import Parameter from "./parameter";
import codemaker = require("codemaker");

interface FoundKey {
  name: string;
  value: any;
}

const DISABLE_CAMEL_FOR = ["AssumeRolePolicyDocument", "PolicyDocument"];

export default class Options {
  data: JSONMap | string;
  references: Array<string>;
  compiled: string;

  private noCamelCase = false;

  constructor(data: JSONMap | string | undefined) {
    this.data = data ? data : {};
    this.references = [];
    this.compiled = this.render(this.data);
  }

  compile(): string {
    return this.compiled;
  }

  render(data: JSONMap | string): string {
    this.noCamelCase = false;
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

  private noCamel(cb: () => string): string {
    const oldCamel = this.noCamelCase;
    this.noCamelCase = true;
    const ret = cb();
    this.noCamelCase = oldCamel;
    return ret;
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
        if (data.Ref.startsWith("AWS::")) {
          const func = data.Ref.replace("AWS::", "");
          // return `(new cdk.Aws${func}()).toString()`;
          return "`${" + `new cdk.Aws${func}()` + "}`";
          // return `"!Ref `
        }
        if (Parameter.isParameter(data.Ref)) {
          return `${codemaker.toCamelCase(data.Ref)}.resolve()`;
        }

        this.references.push(data.Ref);
        // return `new cdk.Token(${codemaker.toCamelCase(data.Ref)}.ref)`;
        return `${codemaker.toCamelCase(data.Ref)}.ref`;
      }
      if (Object.keys(data).length === 1 && data.Condition) {
        return `new cdk.Fn("Condition", ${JSON.stringify(data.Condition)})`;
      }

      const fnKey = this.findFnKey(data);

      if (fnKey) {
        const value =
          fnKey.value instanceof Array ? fnKey.value : [fnKey.value];

        const items = this.noCamel(() =>
          value.map(i => this.renderInner(i)).join(", ")
        );

        return `new cdk.Fn${fnKey.name}(${items})`;
      }

      const items = Object.keys(data).map(k => {
        const key = this.noCamelCase ? k : codemaker.toCamelCase(k);

        const val =
          k.endsWith("PolicyDocument") || k === "Variables"
            ? this.noCamel(() => this.renderInner(data[k]))
            : this.renderInner(data[k]);
        return `${key}: ${val}`;
      });
      return `{ ${items.join(",\n")} }`;
    }

    return JSON.stringify(data);
  }
}
