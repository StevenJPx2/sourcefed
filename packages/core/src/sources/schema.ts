import * as v from "valibot"

export const MonitorSourceSchema = v.intersect([
  v.object({ type: v.string() }),
  v.record(v.string(), v.unknown()),
])
