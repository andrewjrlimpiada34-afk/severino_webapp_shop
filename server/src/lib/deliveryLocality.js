import { createRequire } from 'node:module'
import { areaRegions } from '../../shared/places/index.js'

const load = createRequire(import.meta.url)
export const localityMessage = 'Select a Philippine province or area, its city or municipality, and a barangay from that city. Enter a four-digit ZIP code.'

export function isDeliveryLocality({ province, city, barangay, country, zip }) {
  if (country !== 'Philippines' || !/^\d{4}$/.test(zip) || !Object.hasOwn(areaRegions, province)) return false
  const directory = load(`../../shared/places/${areaRegions[province]}.json`)
  const cities = directory[province]
  return Object.hasOwn(cities, city) && cities[city].includes(barangay)
}
