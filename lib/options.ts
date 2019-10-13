import { JSONNode, JSONMap } from "./types";
import Parameter from "./parameter";
import { toConstant, toCamel, toPascal } from "./util";

const CONDITIONALS = [
  "If",
  "EachMemberEquals",
  "EachMemberIn",
  "Equals",
  "Not",
  "And",
  "Or"
];

export default class Options {
  data: JSONNode;
  references: Array<string>;

  private noCamelCase = false;

  constructor(data: JSONNode) {
    this.data = data ? data : {};
    this.references = [];
  }

  compile(): string {
    this.noCamelCase = false;
    return this.renderInner(this.data);
  }

  private findFnKey(
    data: JSONMap
  ): {
    name: string;
    value: JSONNode;
  } | null {
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

  private renderInner(data: JSONNode): string {
    if (data === null || data === undefined) {
      return "new cdk.AwsNoValue()";
    }

    if (data instanceof Array) {
      const items = data.map(i => this.renderInner(i));
      return `[ ${items.join(",\n")} ]`;
    }

    if (data instanceof Object) {
      if ("Ref" in data && typeof data.Ref == "string") {
        if (data.Ref.startsWith("AWS::")) {
          const func = data.Ref.replace("AWS::", "");
          return `cdk.Aws.${toConstant(func)}`;
        }
        if (Parameter.isParameter(data.Ref)) {
          // TODO: Remember the type of parameter we received so that
          // we can use the correct .value method here
          return `(${toCamel(data.Ref)}.value)`;
        }

        this.references.push(data.Ref);
        return `${toCamel(data.Ref)}.ref`;
      }

      if ("Condition" in data && typeof data.Condition == "string") {
        return toCamel(data.Condition);
      }

      const fnKey = this.findFnKey(data);

      if (fnKey) {
        let name = fnKey.name;
        const value =
          fnKey.value instanceof Array ? fnKey.value : [fnKey.value];
        if (CONDITIONALS.includes(name)) {
          name = `condition${name}`;
        } else if (name == "GetAZs") {
          name = "getAzs";
        } else if (name == "GetAtt") {
          const [ref, att] = value as string[];
          this.references.push(ref);
          return `${toCamel(ref)}.attr${toPascal(att)}`;
        } else {
          name = toCamel(name);
        }

        const items = this.noCamel(() =>
          value.map(i => this.renderInner(i)).join(", ")
        );

        return `cdk.Fn.${name}(${items})`;
      }

      const items = Object.keys(data).map(k => {
        const key = this.noCamelCase ? k : toCamel(k);

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
