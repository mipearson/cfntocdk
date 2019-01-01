import { JSONMap, Construct } from "./types";
import Options from "./options";
import codemaker = require("codemaker");

export default class Condition implements Construct {
  data: JSONMap;
  name: string;

  constructor(name: string, data: JSONMap) {
    this.data = data;
    this.name = name;
  }

  compile(): string {
    return `const ${codemaker.toCamelCase(
      this.name
    )} = new cdk.Condition(this, "${this.name}", 
      ${new Options({ expression: this.data }).compile()}
    );
    
    `;
  }
}
