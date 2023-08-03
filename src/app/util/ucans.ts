import { Link } from "@ucanto/core/schema"

export function jsonOrNull (s: string) {
  try {
    return JSON.parse(s)
  } catch (e) {
    return null
  }
}

export function parseCIDsInNb (nb: Record<string, unknown>) {
  const parsedNb: Record<string, unknown> = {}
  for (const key in nb) {
    const value = nb[key]
    if (typeof value === 'string' && value.startsWith('bagbaiera')) {
      parsedNb[key] = Link.parse(value)
    } else {
      parsedNb[key] = value
    }
  }
  return parsedNb
}