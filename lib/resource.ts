import { JSONResource, Construct, JSONMap } from "./types";
import Options from "./options";
import { toCamel, toConstant } from "./util";

export default class Resource implements Construct {
  public readonly data: JSONResource;
  public readonly name: string;
  public readonly module: string;
  public readonly type: string;
  public readonly references: string[];
  public readonly properties: Options;
  private readonly dependsOn: string[];
  private readonly varName: string;

  public constructor(name: string, data: JSONResource) {
    this.data = data;
    this.name = name;
    this.properties = new Options(data.Properties);
    this.references = [...this.properties.references];
    this.varName = toCamel(this.name);

    const splitType = data.Type.split("::", 3);
    this.module = splitType[1].toLowerCase();
    this.type = splitType[2];

    if (this.data.Condition) {
      this.references.push(this.data.Condition);
    }
    this.dependsOn = [];
    if (this.data.DependsOn) {
      this.dependsOn =
        this.data.DependsOn instanceof Array
          ? this.data.DependsOn
          : [this.data.DependsOn];
      this.references.push(...this.dependsOn);
    }
  }

  public compile(): string {
    let buffer = `const ${this.varName} = new ${this.module}.Cfn${
      this.type
    }(this, "${this.name}",
      ${this.properties.compile()}
    );`;

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
      buffer += this.option("condition", toCamel(this.data.Condition));
    }
    if (this.dependsOn) {
      this.dependsOn.forEach(v => {
        buffer += `\n${this.varName}.addDependsOn(${toCamel(v)});`;
      });
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
