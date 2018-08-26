import { JSONResource } from "./types";
import Options from "./options";

export default class Resource {
  data: JSONResource;
  name: string;
  module: string;
  type: string;
  references: Array<string>;
  options: Options;

  constructor(name: string, data: JSONResource) {
    this.data = data;
    this.name = name;
    this.options = new Options(data.Properties);
    this.references = this.options.references;

    const splitType = data.Type.split("::", 3);
    this.module = splitType[1].toLowerCase();
    this.type = splitType[2];
  }

  compile(): string {
    return `new ${this.module}.cloudformation.${this.type}Resource(this, "${
      this.name
    }", {
      ${this.options.compile()}
    });`;
  }
}
