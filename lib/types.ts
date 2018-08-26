export interface JSONMap {
  [key: string]: any;
}

export interface JSONResource {
  Type: string;
  Properties?: JSONMap;
}
