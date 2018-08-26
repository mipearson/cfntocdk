import prettier = require("prettier");

interface ObjectMap {
  [key: string]: Object;
}
interface Cfn {
  Parameters?: ObjectMap;
  Resources?: ObjectMap;
}

// type JSONType = number | string | Array<JSONType>;

function firstUpper(s: string): string {
  return s.charAt(0).toUpperCase() + s.substring(1);
}

function firstLower(s: string): string {
  return s.charAt(0).toLowerCase() + s.substring(1);
}

function options(o: ObjectMap): string {
  let buffer = "";
  for (let key in o) {
    buffer += `${firstLower(key)}: ${JSON.stringify(o[key])},\n`;
  }
  return buffer;
}

export default class CfnToCDK {
  stackName: string;
  imports: Array<string>;
  parameters: ObjectMap;
  resources: { [key: string]: string };
  // outputs: Array<string>;

  constructor(name: string, json: string) {
    this.stackName = name;
    const cfn = JSON.parse(json) as Cfn;

    this.imports = [];
    this.parameters = {};
    this.resources = {};

    if (cfn.Parameters) {
      this.parameters = cfn.Parameters;
    }
    if (cfn.Resources) {
      for (let name in cfn.Resources) {
        this.addResource(name, cfn.Resources[name] as ObjectMap);
      }
    }
  }

  addResource(name: string, resource: ObjectMap) {
    const splitType = (resource["Type"] as String).split("::", 3);
    const module = splitType[1].toLowerCase();
    const resourceType = splitType[2];

    this.addImport(module);

    this.resources[name] = `
    new ${module}.cloudformation.${resourceType}Resource(this, "${name}", {
    });

    `;
  }

  addImport(name: string) {
    if (this.imports.indexOf(name) === -1) {
      this.imports.push(name);
    }
  }

  compileImports(): string {
    return (
      this.imports
        .map(name => `import ${name} = require('@aws-cdk/aws-${name}');\n`)
        .join("") + "\n"
    );
  }

  compileParameter(name: string, values: ObjectMap): string {
    return `
      const ${firstLower(name)} = new cdk.Parameter(this, "${name}", {
        ${options(values)}
      });

    `;
  }

  compileParameters(): string {
    let buffer = "";
    for (let name in this.parameters) {
      buffer += this.compileParameter(name, this.parameters[name] as ObjectMap);
    }
    return buffer;
  }

  compileResources(): string {
    let buffer = "";
    for (let name in this.resources) {
      buffer += this.resources[name];
    }
    return buffer;
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
