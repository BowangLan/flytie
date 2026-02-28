import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ARTCC_IDS = [
  'ZAB',
  'ZAN',
  'ZAU',
  'ZBW',
  'ZDC',
  'ZDV',
  'ZFW',
  'ZHN',
  'ZHU',
  'ZID',
  'ZJX',
  'ZKC',
  'ZLA',
  'ZLC',
  'ZMA',
  'ZME',
  'ZMP',
  'ZNY',
  'ZOA',
  'ZOB',
  'ZSE',
  'ZSU',
  'ZTL',
]

const SOURCE_INDEX_URL = 'https://nws.weather.gov/schemas/uswx/geodata/artcc/'
const SOURCE_FILE_URL = (id) =>
  `https://nws.weather.gov/schemas/uswx/geodata/artcc/${id}.xml`

function parseCoordinates(xml, id) {
  const posList = xml.match(/<posList[^>]*>([\s\S]*?)<\/posList>/)?.[1]?.trim()
  if (!posList) {
    throw new Error(`Missing posList for ${id}`)
  }

  const values = posList.split(/\s+/).map(Number)
  const coordinates = []

  for (let index = 0; index < values.length; index += 2) {
    const latitude = values[index]
    const longitude = values[index + 1]
    coordinates.push([longitude, latitude])
  }

  return coordinates
}

async function buildFeature(id) {
  const response = await fetch(SOURCE_FILE_URL(id))
  if (!response.ok) {
    throw new Error(`Failed to fetch ${id}: ${response.status}`)
  }

  const xml = await response.text()

  return {
    type: 'Feature',
    properties: {
      id,
      name: id,
      kind: 'ARTCC',
    },
    geometry: {
      type: 'Polygon',
      coordinates: [parseCoordinates(xml, id)],
    },
  }
}

async function main() {
  const features = await Promise.all(ARTCC_IDS.map(buildFeature))
  const output = {
    type: 'FeatureCollection',
    name: 'US ARTCC Boundaries',
    metadata: {
      generatedAt: new Date().toISOString(),
      source: 'NOAA / NWS USWX ARTCC boundary polygons',
      sourceIndexUrl: SOURCE_INDEX_URL,
      featureCount: features.length,
    },
    features,
  }

  const scriptDir = path.dirname(fileURLToPath(import.meta.url))
  const outputDir = path.resolve(scriptDir, '../public/data/airspace')
  const outputPath = path.join(outputDir, 'us-artcc-boundaries.geojson')

  await mkdir(outputDir, { recursive: true })
  await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8')

  console.log(`Wrote ${outputPath}`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
