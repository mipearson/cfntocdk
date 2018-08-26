import { isObject } from "util";
import prettier = require("prettier");

interface Cfn {
  Parameters?: Object;
  resources?: Object;
}

interface MapObject {
  [key: string]: any;
}

// type JSONType = number | string | Array<JSONType>;

function firstUpper(s: string): string {
  return s.charAt(0).toUpperCase() + s.substring(1);
}

function firstLower(s: string): string {
  return s.charAt(0).toLowerCase() + s.substring(1);
}

function options(o: Object): string {
  let buffer = "";
  for (let key in o) {
    buffer += `${firstLower(key)}: ${JSON.stringify(o[key])},\n`;
  }
  return buffer;
}

export default class CfnToCDK {
  stackName: string;
  imports: Array<string>;
  parameters: Object;
  // resources: Array<string>;
  // outputs: Array<string>;

  constructor(name: string, json: string) {
    this.stackName = name;
    const cfn = JSON.parse(json) as Cfn;

    this.imports = [];
    this.parameters = {};
    if (cfn.Parameters && isObject(cfn.Parameters)) {
      this.parameters = cfn.Parameters;
    }
  }

  compileImports(): string {
    return (
      this.imports
        .map(name => `import ${name} = require('@aws-cdk/aws-${name}');`)
        .join("") + "\n"
    );
  }

  compileParameter(name: string, values: Object): string {
    // const loggingBucket = new cdk.Parameter(this, "LoggingBucket", {
    //   description: "The name of the bucket to send cloudtrail logs to",
    //   type: "String"
    // });

    let buffer = `const ${firstLower(
      name
    )} = new cdk.Parameter(this, "${name}", {\n`;

    buffer += options(values);

    return buffer + `});\n\n`;
  }

  compileParameters(): string {
    let buffer = "";
    for (let name in this.parameters) {
      buffer += this.compileParameter(name, this.parameters[name]);
    }
    return buffer;
  }

  compileResources(): string {
    return "";
  }

  compileOutputs(): string {
    return "";
  }

  compile(): string {
    let buffer = "";

    buffer += "import cdk = require('@aws-cdk/cdk');\n";
    buffer += this.compileImports();

    buffer += "\n";
    buffer += `export class ${firstUpper(
      this.stackName
    )}Stack extends cdk.Stack {\n`;

    buffer +=
      "constructor(parent: cdk.App, id: string, props?: cdk.StackProps) {\n";
    buffer += "super(parent, id, props);\n\n";

    buffer += this.compileParameters();
    buffer += this.compileResources();
    buffer += this.compileOutputs();

    buffer += "}}";

    return prettier.format(buffer, { parser: "typescript" });
  }
}
