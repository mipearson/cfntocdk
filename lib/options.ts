import { firstLower } from "./util";
import { JSONMap } from "./types";

export default class Options {
  data: JSONMap;
  references: Array<string>;
  compiled: string;

  constructor(data: JSONMap | undefined) {
    this.data = data ? data : {};
    this.references = [];
    this.compiled = this.render(this.data);
  }

  compile(): string {
    return this.compiled;
  }

  render(data: JSONMap): string {
    let buffer = "";
    for (let key in data) {
      const val = data[key];
      if (val instanceof Object) {
        if (val.Ref) {
          buffer += `${firstLower(key)}: ${firstLower(val.Ref)}.ref,\n`;
          this.references.push(val.Ref);
        } else {
          buffer += `${firstLower(key)}: { ${this.render(val as JSONMap)} },\n`;
        }
      } else {
        buffer += `${firstLower(key)}: ${JSON.stringify(data[key])},\n`;
      }
    }
    return buffer;
  }
}
