export const PRIMARY_TYPE_KEYS = [
  'automotive',
  'business',
  'culture',
  'education',
  'entertainmentAndRecreation',
  'facilities',
  'finance',
  'foodAndDrink',
  'geographicalAreas',
  'government',
  'healthAndWellness',
  'housing',
  'lodging',
  'naturalFeatures',
  'placesOfWorship',
  'services',
  'shopping',
  'sports',
  'transportation',
] as const

export type PrimaryTypeKey = (typeof PRIMARY_TYPE_KEYS)[number]

function splitCamel(key: string): string {
  return key.replace(/([a-z])([A-Z])/g, '$1 $2')
}

export function labelForPrimaryType(key: PrimaryTypeKey): string {
  const [first, ...rest] = splitCamel(key).split(' ')
  if (!first) {
    return key
  }
  return [first.charAt(0).toUpperCase() + first.slice(1), ...rest.map((part) => part.toLowerCase())].join(' ')
}
