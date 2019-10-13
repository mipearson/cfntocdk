import { JSONMap, Construct } from "./types";
import Options from "./options";

export default class Output implements Construct {
  private readonly data: JSONMap;
  public readonly name: string;

  public constructor(name: string, data: JSONMap) {
    this.data = data;
    this.name = name;
  }

  public compile(): string {
    return `new cdk.CfnOutput(this, "${this.name}",
      ${new Options(this.data).compile()}
    );

    `;
  }
}
