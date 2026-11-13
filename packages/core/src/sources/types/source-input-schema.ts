/**
 * The JSON Schema of one source's create input, without its `type`. Agent tools
 * combine every source's into one union tagged by `type`; `Monitor.build` still
 * enforces the input.
 */
export type SourceInputSchema = {
  description: string
  properties: Record<string, Record<string, unknown>>
  required: string[]
}
