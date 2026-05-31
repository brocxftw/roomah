# Downloads the canonical property-type stock images from Unsplash into
# frontend/public/property-stock. Run from the frontend/public/property-stock
# directory. Re-run this script if you ever need to refresh the stock images.

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$images = @{
  'apartment.jpg'         = 'https://images.unsplash.com/photo-1515263487990-61b07816b324?crop=entropy&cs=srgb&fm=jpg&q=85&w=1600&fit=max'
  'condominium.jpg'       = 'https://images.unsplash.com/photo-1771433054606-f8a343a5709d?crop=entropy&cs=srgb&fm=jpg&q=85&w=1600&fit=max'
  'bungalow.jpg'          = 'https://images.unsplash.com/photo-1779813377622-df4c5a982230?crop=entropy&cs=srgb&fm=jpg&q=85&w=1600&fit=max'
  'terrace-house.jpg'     = 'https://images.unsplash.com/photo-1568293207619-df44ae062a9c?crop=entropy&cs=srgb&fm=jpg&q=85&w=1600&fit=max'
  'semi-detached.jpg'     = 'https://images.unsplash.com/photo-1570129477492-45c003edd2be?crop=entropy&cs=srgb&fm=jpg&q=85&w=1600&fit=max'
  'townhouse.jpg'         = 'https://images.unsplash.com/photo-1627141234469-24711efb373c?crop=entropy&cs=srgb&fm=jpg&q=85&w=1600&fit=max'
  'studio.jpg'            = 'https://images.unsplash.com/photo-1702014862053-946a122b920d?crop=entropy&cs=srgb&fm=jpg&q=85&w=1600&fit=max'
  'penthouse.jpg'         = 'https://images.unsplash.com/photo-1565623833408-d77e39b88af6?crop=entropy&cs=srgb&fm=jpg&q=85&w=1600&fit=max'
  'villa.jpg'             = 'https://images.unsplash.com/photo-1706808849780-7a04fbac83ef?crop=entropy&cs=srgb&fm=jpg&q=85&w=1600&fit=max'
  'shophouse.jpg'         = 'https://images.unsplash.com/photo-1596051723702-b56e223bfa66?crop=entropy&cs=srgb&fm=jpg&q=85&w=1600&fit=max'
  'commercial-office.jpg' = 'https://images.unsplash.com/photo-1724906019868-93ad2c79414f?crop=entropy&cs=srgb&fm=jpg&q=85&w=1600&fit=max'
  'land.jpg'              = 'https://images.unsplash.com/photo-1518717202715-9fa9d099f58a?crop=entropy&cs=srgb&fm=jpg&q=85&w=1600&fit=max'
  'default.jpg'           = 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?crop=entropy&cs=srgb&fm=jpg&q=85&w=1600&fit=max'
}

foreach ($entry in $images.GetEnumerator()) {
  Write-Host "Downloading $($entry.Key)..."
  Invoke-WebRequest -Uri $entry.Value -OutFile $entry.Key -UseBasicParsing
}

Write-Host "Done. Files written to $(Get-Location)."
