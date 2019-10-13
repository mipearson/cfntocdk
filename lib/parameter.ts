import { JSONMap, Construct } from "./types";
import Options from "./options";
import { toCamel } from "./util";

export default class Parameter implements Construct {
  data: JSONMap;
  name: string;

  static known: Array<string> = [];

  static isParameter(name: string): boolean {
    return this.known.findIndex(a => a === name) != -1;
  }

  constructor(name: string, data: JSONMap) {
    this.data = data;
    this.name = name;
    Parameter.known.push(name);
  }

  compile(): string {
    return `const ${toCamel(this.name)} = new cdk.CfnParameter(this, "${
      this.name
    }",
      ${new Options(this.data).compile()}
    );

    `;
  }
}
