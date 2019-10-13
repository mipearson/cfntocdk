import camelCase = require("lodash.camelcase");
import snakeCase = require("lodash.snakecase");

export function firstUpper(s: string): string {
  return s.charAt(0).toUpperCase() + s.substring(1);
}

export function firstLower(s: string): string {
  return s.charAt(0).toLowerCase() + s.substring(1);
}

// CDK wants "targetGroupArns", not "targetGroupARNs" or "targetGroupArNs".
export function flattenCapitals(s: string): string {
  return s.replace(
    /([A-Z])([A-Z]+)(s?)$/,
    (_, p1, p2, p3) => p1 + p2.toLowerCase() + p3
  );
}

export function toCamel(s: string): string {
  return camelCase(flattenCapitals(s));
}

export function toConstant(s: string): string {
  return snakeCase(flattenCapitals(s)).toUpperCase();
}

export function toPascal(s: string): string {
  return firstUpper(camelCase(flattenCapitals(s)));
}
