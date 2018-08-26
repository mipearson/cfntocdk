import { JSONMap } from "./types";
import Options from "./options";

export default class Parameter {
  data: JSONMap;
  name: string;

  constructor(name: string, data: JSONMap) {
    this.data = data;
    this.name = name;
  }

  compile(): string {
    return `new cdk.Parameter(this, "${this.name}", {
      ${new Options(this.data).compile()}
    });`;
  }
}
