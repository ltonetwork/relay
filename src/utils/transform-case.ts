export function pascalCase(input: string): string {
  return input.replace(/(-\w)/g, (_, c: string) => c.toUpperCase());
}

export function camelCase(input: string): string {
  return input.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
}
