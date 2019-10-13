import prettier = require("prettier");
import Parameter from "./lib/parameter";
import Condition from "./lib/condition";
import Output from "./lib/output";
import { JSONResource, JSONMap, Construct } from "./lib/types";
import Resource from "./lib/resource";
import toposort = require("toposort");
import { toCamel, toPascal } from "./lib/util";

interface JSONCfn {
  Parameters?: { [key: string]: JSONMap };
  Outputs?: { [key: string]: JSONMap };
  Conditions?: { [key: string]: JSONMap };
  Resources?: { [key: string]: JSONResource };
  Mappings?: JSONMap;
  [key: string]: unknown;
}

interface Option {
  name: string;
  value: string;
}

export default class CfnToCDK {
  stackName: string;
  parameters: Array<Parameter>;
  resources: Array<Resource>;
  conditions: Array<Condition>;
  outputs: Array<Output>;
  cfn: JSONCfn;

  // outputs: Array<string>;

  constructor(name: string, json: string) {
    this.stackName = name;
    this.cfn = JSON.parse(json) as JSONCfn;

    this.parameters = [];
    this.conditions = [];
    this.resources = [];

    if (this.cfn.Parameters) {
      for (let name in this.cfn.Parameters) {
        this.parameters.push(new Parameter(name, this.cfn.Parameters[name]));
      }
    }
    if (this.cfn.Conditions) {
      for (let name in this.cfn.Conditions) {
        this.conditions.push(new Condition(name, this.cfn.Conditions[name]));
      }
    }
    if (this.cfn.Resources) {
      for (let name in this.cfn.Resources) {
        this.resources.push(new Resource(name, this.cfn.Resources[name]));
      }
    }
    this.outputs = Object.entries(this.cfn.Outputs || []).map(
      ([name, data]) => new Output(name, data)
    );
  }

  compileImports(): string {
    const imports: { [key: string]: boolean } = {};

    this.resources.forEach(i => {
      if (i.module) {
        imports[toCamel(i.module)] = true;
      }
    });

    let buffer = "";
    for (let name in imports) {
      buffer += `import * as ${name} from '@aws-cdk/aws-${name}';\n`;
    }
    return buffer;
  }

  compileParameters(): string {
    return this.parameters.map(a => a.compile()).join("");
  }

  compileConditions(): string {
    return this.conditions.map(a => a.compile()).join("");
  }

  compileMappings(): string {
    if (!this.cfn.Mappings) return "";

    const mappings = this.cfn.Mappings;

    return Object.keys(mappings)
      .map(
        k => `new cdk.CfnMapping(this, ${JSON.stringify(
          k
        )}, {mapping: ${JSON.stringify(mappings[k])}});

    `
      )
      .join("");
  }

  // withConstIfReferenced = (c: Construct): string => {
  //   let buffer = c.compile() + "\n\n";
  //   if (this.isReferenced(c.name)) {
  //     buffer = `const ${codemaker.toCamelCase(c.name)} = ${buffer}`;
  //   }

  //   return buffer;
  // };

  // isReferenced(name: string): boolean {
  //   return (
  //     this.resources.findIndex(r => r.references.indexOf(name) !== -1) !== -1
  //   );
  // }

  compileResources(): string {
    const graph: Array<[string, string]> = [];

    this.resources.forEach(r => {
      r.references.forEach(ref => {
        graph.push([r.name, ref]);
      });
      graph.push([r.name, "nil"]);
    });

    const ordered = toposort(graph) as Array<string>;

    let buffer = "";

    ordered.reverse().forEach(name => {
      const resource = this.resources.find(r => r.name === name);
      if (resource) {
        buffer += resource.compile();
      }
    });

    return buffer;
  }

  compileOutputs(): string {
    return this.outputs.map(a => a.compile()).join("");
  }

  compileOptions(): string {
    const mappings = {
      templateFormatVersion: this.cfn.AWSTemplateFormatVersion,
      description: this.cfn.Description,
      metadata: this.cfn.Metadata
    };

    return Object.entries(mappings)
      .map(([k, v]) =>
        v ? `this.templateOptions.${k} = ${JSON.stringify(v)};` : undefined
      )
      .filter(v => v)
      .join("\n");
  }

  compile(): string {
    const buffer = `
    import * as cdk from '@aws-cdk/core';
    ${this.compileImports()}

    export class ${toPascal(this.stackName)}Stack extends cdk.Stack {
      constructor(parent: cdk.App, id: string, props?: cdk.StackProps) {
        super(parent, id, props);

        ${this.compileOptions()};

        ${this.compileParameters()};
        ${this.compileMappings()};
        ${this.compileConditions()};
        ${this.compileResources()};
        ${this.compileOutputs()};
      }
    }
    `;

    return prettier.format(buffer, { parser: "typescript" });
  }
}
