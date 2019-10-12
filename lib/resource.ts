import { JSONResource, Construct, JSONMap } from "./types";
import Options from "./options";
import codemaker = require("codemaker");

export default class Resource implements Construct {
  data: JSONResource;
  name: string;
  module: string;
  type: string;
  references: Array<string>;
  properties: Options;
  private varName: string;
  private compiled: string;

  constructor(name: string, data: JSONResource) {
    this.data = data;
    this.name = name;
    this.properties = new Options(data.Properties);
    this.references = this.properties.references;
    this.varName = codemaker.toCamelCase(this.name);

    const splitType = data.Type.split("::", 3);
    this.module = splitType[1].toLowerCase();
    this.type = splitType[2];

    this.compiled = `const ${this.varName} = new ${this.module}.Cfn${
      this.type
    }(this, "${this.name}",
      ${this.properties.compile()}
    );`;

    if (this.data.CreationPolicy) {
      this.addOption(
        "creationPolicy",
        new Options(this.data.CreationPolicy).compile()
      );
    }
    if (this.data.UpdatePolicy) {
      this.addOption(
        "updatePolicy",
        new Options(this.data.UpdatePolicy).compile()
      );
    }

    if (this.data.DeletionPolicy) {
      const policy =
        typeof this.data.DeletionPolicy === "string"
          ? `cdk.CfnDeletionPolicy.${codemaker
              .toSnakeCase(this.data.DeletionPolicy)
              .toUpperCase()}`
          : new Options(this.data.DeletionPolicy).compile();

      this.addOption("deletionPolicy", policy);
    }
    if (this.data.Condition) {
      this.addOption("condition", codemaker.toCamelCase(this.data.Condition));
      this.references.push(this.data.Condition);
    }
    if (this.data.DependsOn) {
      let val = this.data.DependsOn;
      val = val instanceof Array ? val : [val];
      val.forEach(v => {
        this.compiled += `\n${
          this.varName
        }.addDependsOn(${codemaker.toCamelCase(v)});`;
        this.references.push(v);
      });
    }

    this.compiled += "\n\n";
  }

  compile(): string {
    return this.compiled;
  }

  private addOption(name: string, value: string) {
    this.compiled += `\n${this.varName}.cfnOptions.${name} = ${value};`;
  }
}
