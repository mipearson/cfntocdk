import { firstLower } from "./util";
import { JSONMap } from "./types";

export default class Options {
  data: JSONMap;
  constructor(data: JSONMap | undefined) {
    this.data = data ? data : {};
  }

  compile(): string {
    return this.render(this.data);
  }

  render(data: JSONMap): string {
    let buffer = "";
    for (let key in data) {
      const val = data[key];
      if (val instanceof Object) {
        if (val.Ref) {
          buffer += `${firstLower(key)}: ${firstLower(val.Ref)}.ref,\n`;
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
