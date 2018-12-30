export function firstUpper(s: string): string {
  return s.charAt(0).toUpperCase() + s.substring(1);
}

export function firstLower(s: string): string {
  return s.charAt(0).toLowerCase() + s.substring(1);
}

/**
 * Convert a CloudFormation name to a nice TypeScript name
 *
 * We use a library to camelcase, and fix up some things that translate incorrectly.
 *
 * For example, the library breaks when pluralizing an abbreviation, such as "ProviderARNs" -> "providerArNs".
 *
 * We currently recognize "ARNs", "MBs" and "AZs".
 */
// export function cloudFormationToScriptName(name: string): string {
//   if (name === 'VPCs') { return 'vpcs'; }
//   const ret = codemaker.toCamelCase(name);

//   const suffixes: { [key: string]: string } = { ARNs: 'Arns', MBs: 'MBs', AZs: 'AZs' };

//   for (const suffix of Object.keys(suffixes)) {
//     if (name.endsWith(suffix)) {
//       return ret.substr(0, ret.length - suffix.length) + suffixes[suffix];
//     }
//   }

//   return ret;
// }
