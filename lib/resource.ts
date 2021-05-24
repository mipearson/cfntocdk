import { JSONResource, Construct, JSONMap } from "./types";
import Options from "./options";
import { toCamel, toConstant } from "./util";

export default class Resource implements Construct {
  public readonly name: string;
  public readonly module: string;
  public readonly references: string[] = [];
  private readonly type: string;
  private readonly data: JSONResource;
  private readonly varName: string;

  public constructor(name: string, data: JSONResource) {
    this.data = data;
    this.name = name;
    this.varName = toCamel(this.name);

    const splitType = data.Type.split("::", 3);
    this.module = splitType[1].toLowerCase();
    this.type = splitType[2];
  }

  public compile(): string {
    const properties = new Options(this.data.Properties);
    let buffer = `const ${this.varName} = new ${this.module}.Cfn${
      this.type
    }(this, "${this.name}",
      ${properties.compile()}
    );`;
    this.references.push(...properties.references);

    if (this.data.CreationPolicy) {
      buffer += this.option(
        "creationPolicy",
        new Options(this.data.CreationPolicy).compile()
      );
    }
    if (this.data.UpdatePolicy) {
      buffer += this.option(
        "updatePolicy",
        new Options(this.data.UpdatePolicy).compile()
      );
    }

    if (this.data.DeletionPolicy) {
      const policy =
        typeof this.data.DeletionPolicy === "string"
          ? `cdk.CfnDeletionPolicy.${toConstant(this.data.DeletionPolicy)}`
          : new Options(this.data.DeletionPolicy).compile();

      buffer += this.option("deletionPolicy", policy);
    }
    if (this.data.Condition) {
      this.references.push(this.data.Condition);
      buffer += this.option("condition", toCamel(this.data.Condition));
    }
    if (this.data.DependsOn) {
      const dependsOn =
        this.data.DependsOn instanceof Array
          ? this.data.DependsOn
          : [this.data.DependsOn];
      dependsOn.forEach((v) => {
        buffer += `\n${this.varName}.addDependsOn(${toCamel(v)});`;
      });
      this.references.push(...dependsOn);
    }
    if (this.data.Metadata) {
      buffer += this.option("metadata", JSON.stringify(this.data.Metadata));
    }

    return buffer + "\n\n";
  }

  private option(name: string, value: string): string {
    return `\n${this.varName}.cfnOptions.${name} = ${value};`;
  }
}
