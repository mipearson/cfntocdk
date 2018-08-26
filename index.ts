import prettier = require("prettier");
import Parameter from "./lib/parameter";
import { JSONResource, JSONMap } from "./lib/types";
import Resource from "./lib/resource";
import { firstLower, firstUpper } from "./lib/util";

interface JSONCfn {
  Parameters?: { [key: string]: JSONMap };
  Resources?: { [key: string]: JSONResource };
}

export default class CfnToCDK {
  stackName: string;
  parameters: Array<Parameter>;
  resources: Array<Resource>;
  // outputs: Array<string>;

  constructor(name: string, json: string) {
    this.stackName = name;
    const cfn = JSON.parse(json) as JSONCfn;

    this.parameters = [];
    this.resources = [];

    if (cfn.Parameters) {
      for (let name in cfn.Parameters) {
        this.parameters.push(new Parameter(name, cfn.Parameters[name]));
      }
    }
    if (cfn.Resources) {
      for (let name in cfn.Resources) {
        this.resources.push(new Resource(name, cfn.Resources[name]));
      }
    }
  }

  compileImports(): string {
    const imports: { [key: string]: boolean } = {};

    this.resources.forEach(i => {
      if (i.module) {
        imports[firstLower(i.module)] = true;
      }
    });

    let buffer = "";
    for (let name in imports) {
      buffer += `import ${name} = require('@aws-cdk/aws-${name}');\n`;
    }
    return buffer;
  }

  compileParameters(): string {
    return this.parameters
      .map(
        parameter =>
          `const ${firstLower(parameter.name)} = ${parameter.compile()};\n\n`
      )
      .join("");
  }

  compileResources(): string {
    return this.resources
      .map(resources => `${resources.compile()};\n\n`)
      .join("");
  }

  compileOutputs(): string {
    return "";
  }

  compile(): string {
    const buffer = `
    import cdk = require('@aws-cdk/cdk');
    ${this.compileImports()}

    export class ${firstUpper(this.stackName)}Stack extends cdk.Stack {
      constructor(parent: cdk.App, id: string, props?: cdk.StackProps) {
        super(parent, id, props);

        ${this.compileParameters()};
        ${this.compileResources()};
        ${this.compileOutputs()};
      }
    }
    `;

    return prettier.format(buffer, { parser: "typescript" });
  }
}
