import { JSONMap, Construct } from "./types";
import Options from "./options";
import { toCamel } from "./util";

export default class Condition implements Construct {
  data: JSONMap;
  name: string;

  constructor(name: string, data: JSONMap) {
    this.data = data;
    this.name = name;
  }

  compile(): string {
    return `const ${toCamel(this.name)} = new cdk.CfnCondition(this, "${
      this.name
    }",
      ${new Options({ expression: this.data }).compile()}
    );

    `;
  }
}
