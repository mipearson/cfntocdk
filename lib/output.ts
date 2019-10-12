import { JSONMap, Construct } from "./types";
import Options from "./options";
import codemaker = require("codemaker");

export default class Output implements Construct {
  data: JSONMap;
  name: string;

  static known: Array<string> = [];

  constructor(name: string, data: JSONMap) {
    this.data = data;
    this.name = name;
  }

  compile(): string {
    return `new cdk.CfnOutput(this, "${this.name}",
      ${new Options(this.data).compile()}
    );

    `;
  }
}
