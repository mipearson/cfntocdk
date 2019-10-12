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
    return this.renderInner(data, true);
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

  private renderInner(data: any, scalarNeeded = false): string {
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
          return `cdk.Aws.${codemaker.toSnakeCase(func).toUpperCase()}`;
        }
        if (Parameter.isParameter(data.Ref)) {
          // TODO: Remember the type of parameter we received so that
          // we can use the correct .value method here
          return `(${codemaker.toCamelCase(data.Ref)}.value as any)`;
          // return `${codemaker.toCamelCase(data.Ref)}.value`;
        }

        this.references.push(data.Ref);
        return `${codemaker.toCamelCase(data.Ref)}.ref`;
      }

      if (data.Condition) {
        return codemaker.toCamelCase(data.Condition);
      }

      const fnKey = this.findFnKey(data);

      if (fnKey) {
        let name = fnKey.name;
        if (
          [
            "If",
            "EachMemberEquals",
            "EachMemberIn",
            "Equals",
            "Not",
            "And",
            "Or"
          ].includes(name)
        ) {
          name = `condition${name}`;
        } else if (name == "GetAZs") {
          name = "getAzs";
        } else if (name == "GetAtt") {
          const [ref, att] = fnKey.value;
          this.references.push(ref);
          return `${codemaker.toCamelCase(ref)}.attr${att}`;
        } else {
          name = codemaker.toCamelCase(name);
        }
        const value =
          fnKey.value instanceof Array ? fnKey.value : [fnKey.value];

        const items = this.noCamel(() =>
          value.map(i => this.renderInner(i)).join(", ")
        );
        return `cdk.Fn.${name}(${items})`;
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
