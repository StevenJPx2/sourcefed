export const webhookState: {
  server: ReturnType<typeof Bun.serve> | undefined
} = {
  server: undefined,
}
