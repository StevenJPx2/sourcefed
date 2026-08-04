export function adfText(node: any): string {
  if (!node || typeof node !== "object") return ""
  if (typeof node.text === "string") return node.text
  if (Array.isArray(node.content)) return node.content.map(adfText).join("")
  return ""
}
