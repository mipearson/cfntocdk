import { JSONMap, JSONResource } from "./types";
import Options from "./options";

export default class Resource {
  data: JSONResource;
  name: string;
  module: string;
  type: string;

  constructor(name: string, data: JSONResource) {
    this.data = data;
    this.name = name;

    const splitType = data.Type.split("::", 3);
    this.module = splitType[1].toLowerCase();
    this.type = splitType[2];
  }

  compile(): string {
    return `new ${this.module}.cloudformation.${this.type}Resource(this, "${
      this.name
    }", {
      ${new Options(this.data.Properties).compile()}
    });`;
  }
}
