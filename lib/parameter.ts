import { JSONMap, Construct } from "./types";
import Options from "./options";
import { toCamel } from "./util";

export default class Parameter implements Construct {
  private data: JSONMap;
  public name: string;

  private static known: Array<string> = [];

  public static isParameter(name: string): boolean {
    return this.known.findIndex(a => a === name) != -1;
  }

  public constructor(name: string, data: JSONMap) {
    this.data = data;
    this.name = name;
    Parameter.known.push(name);
  }

  public compile(): string {
    return `const ${toCamel(this.name)} = new cdk.CfnParameter(this, "${
      this.name
    }",
      ${new Options(this.data).compile()}
    );

    `;
  }
}
