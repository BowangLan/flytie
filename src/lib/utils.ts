import type { ClassValue } from 'clsx'
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// returns the size of the object in bytes
export function roughObjectSize(obj: any, visited = new Set()) {
  if (obj === null || obj === undefined) return 0;
  if (typeof obj !== 'object') {
    if (typeof obj === 'string') return obj.length * 2 + 50; // ~UTF-16 + overhead
    if (typeof obj === 'number' || typeof obj === 'boolean') return 8;
    return 0;
  }

  if (visited.has(obj)) return 0; // avoid circular structures
  visited.add(obj);

  let bytes = 50; // base object overhead (~40-100 bytes depending on engine)

  if (Array.isArray(obj)) {
    bytes += 40; // array overhead
    return bytes + obj.reduce((sum, v) => sum + roughObjectSize(v, visited), 0);
  }

  // Plain object / Map / Set
  if (obj instanceof Map || obj instanceof Set) {
    bytes += 100; // rough container overhead
    for (const [k, v] of obj) {
      bytes += roughObjectSize(k, visited) + roughObjectSize(v, visited) + 32;
    }
    return bytes;
  }

  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      bytes += roughObjectSize(key, visited) + roughObjectSize(obj[key], visited) + 32; // prop entry
    }
  }

  return bytes;
}

export const jsonObjSize = (obj: any) => {
  return new TextEncoder().encode(JSON.stringify(obj)).length;
}