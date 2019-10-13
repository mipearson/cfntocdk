export interface JSONMap {
  [k: string]: JSONNode;
}

export interface JSONResource {
  Type: string;
  Properties?: JSONMap;
  CreationPolicy?: JSONMap | string;
  UpdatePolicy?: JSONMap | string;
  DeletionPolicy?: JSONMap | string;
  Condition?: string;
  DependsOn?: string | string[];
  Metadata?: unknown;
}

export interface Construct {
  name: string;
  compile: () => string;
}

export interface JSONArray extends Array<JSONNode> {}

export type JSONNode = null | undefined | JSONArray | JSONMap | string | number;
