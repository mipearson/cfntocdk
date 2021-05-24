import prettier = require("prettier");
import Parameter from "./parameter";
import Condition from "./condition";
import Output from "./output";
import { JSONResource, JSONMap, JSONNode } from "./types";
import Resource from "./resource";
import toposort = require("toposort");
import { toCamel, toPascal } from "./util";

interface CfnSource {
  Parameters?: { [key: string]: JSONMap };
  Outputs?: { [key: string]: JSONMap };
  Conditions?: { [key: string]: JSONMap };
  Resources?: { [key: string]: JSONResource };
  Mappings?: JSONMap;
  [key: string]: unknown;
}

export default class Stack {
  public stackName: string;
  private parameters: Array<Parameter>;
  private resources: Array<Resource>;
  private conditions: Array<Condition>;
  private outputs: Array<Output>;
  private cfn: CfnSource;

  constructor(name: string, json: string) {
    this.stackName = name;
    this.cfn = JSON.parse(json) as CfnSource;

    this.parameters = [];
    this.conditions = [];
    this.resources = [];

    this.parameters = Object.entries(this.cfn.Parameters || []).map(
      ([name, data]) => new Parameter(name, data)
    );
    this.conditions = Object.entries(this.cfn.Conditions || []).map(
      ([name, data]) => new Condition(name, data)
    );
    this.resources = Object.entries(this.cfn.Resources || []).map(
      ([name, data]) => new Resource(name, data)
    );
    this.outputs = Object.entries(this.cfn.Outputs || []).map(
      ([name, data]) => new Output(name, data)
    );
  }

  compileImports(): string {
    const imports: { [key: string]: boolean } = {};

    this.resources.forEach((i) => {
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
    return this.parameters.map((a) => a.compile()).join("");
  }

  compileConditions(): string {
    return this.conditions.map((a) => a.compile()).join("");
  }

  compileMappings(): string {
    if (!this.cfn.Mappings) return "";

    const mappings = this.cfn.Mappings;

    return Object.keys(mappings)
      .map(
        (k) => `new cdk.CfnMapping(this, ${JSON.stringify(
          k
        )}, {mapping: ${JSON.stringify(mappings[k])}});

    `
      )
      .join("");
  }

  compileResources(): string {
    const graph: Array<[string, string]> = [];

    const compiledResources: { [k: string]: string } = {};
    this.resources.forEach((r) => {
      compiledResources[r.name] = r.compile();
    });

    this.resources.forEach((r) => {
      r.references.forEach((ref) => {
        graph.push([r.name, ref]);
      });
      graph.push([r.name, "nil"]);
    });

    const ordered = toposort(graph) as Array<string>;

    return ordered
      .reverse()
      .map((name) => compiledResources[name])
      .filter((s) => s)
      .join("");
  }

  compileOutputs(): string {
    return this.outputs.map((a) => a.compile()).join("");
  }

  compileOptions(): string {
    const mappings = {
      templateFormatVersion: this.cfn.AWSTemplateFormatVersion,
      description: this.cfn.Description,
      metadata: this.cfn.Metadata,
    };

    return Object.entries(mappings)
      .map(([k, v]) =>
        v ? `this.templateOptions.${k} = ${JSON.stringify(v)};` : undefined
      )
      .filter((v) => v)
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
