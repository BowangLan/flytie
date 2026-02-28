export type AircraftSizeCategory =
  | 'unknown'
  | 'small'
  | 'medium'
  | 'large'
  | 'heavy'

function normalizeAdsbCategory(category?: string | null) {
  if (!category) return null
  const normalized = category.trim().toUpperCase()
  return normalized.length > 0 ? normalized : null
}

export function getAircraftSizeCategory(
  category?: string | null,
): AircraftSizeCategory {
  switch (normalizeAdsbCategory(category)) {
    case 'A1':
    case 'A2':
    case 'B1':
    case 'B2':
    case 'B3':
    case 'B4':
    case 'B6':
    case 'C1':
    case 'C2':
    case 'C3':
    case 'C4':
    case 'C5':
    case 'F1':
    case 'F2':
    case 'F4':
    case 'F6':
    case 'F7':
    case 'F11':
    case 'F12':
    case 'F13':
    case 'F15':
      return 'small'
    case 'A3':
    case 'A6':
    case 'A7':
    case 'F3':
    case 'F5':
    case 'F8':
    case 'F9':
      return 'medium'
    case 'A4':
      return 'large'
    case 'A5':
      return 'heavy'
    case 'A0':
    case 'B0':
    case 'C0':
    case 'F0':
    default:
      return 'unknown'
  }
}

export function getAircraftSizeScale(category?: string | null) {
  switch (getAircraftSizeCategory(category)) {
    case 'small':
      return 0.5
    case 'medium':
      return 2
    case 'large':
      return 4;
    case 'heavy':
      return 6;
    case 'unknown':
    default:
      return 1
  }
  // randomly choose between 0.5 and 5
  // return Math.random() * 4.5 + 0.5
}
