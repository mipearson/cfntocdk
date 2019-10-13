export interface JSONMap {
  [key: string]: any;
}

export interface JSONResource {
  Type: string;
  Properties?: JSONMap;
  CreationPolicy?: JSONMap | string;
  UpdatePolicy?: JSONMap | string;
  DeletionPolicy?: JSONMap | string;
  Condition?: string;
  DependsOn?: string | Array<string>;
  Metadata?: unknown;
}

export interface Construct {
  name: string;
  compile: () => string;
}
