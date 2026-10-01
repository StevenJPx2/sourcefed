export function flag(args: string[], name: string): string | undefined {
  const index = args.indexOf(`--${name}`)
  return index >= 0 ? args[index + 1] : undefined
}

/** Every value of a repeatable flag, in order: `--name a --name b` gives `["a", "b"]`. */
export function flags(args: string[], name: string): string[] {
  return args.flatMap((arg, index) => (arg === `--${name}` && index + 1 < args.length ? [args[index + 1]] : []))
}
