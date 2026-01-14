# Geo-Location Map Visualization

The SqlDB Admin UI now includes an interactive map visualization feature to display your geo-located data graphically using Leaflet/OpenStreetMap.

## Features

### 1. Interactive Map View
- **OpenStreetMap Integration**: High-quality, free map tiles
- **Real-time Rendering**: Visualize thousands of locations instantly
- **Zoom & Pan**: Navigate the map to explore different regions
- **Responsive Design**: Works on desktop and mobile devices

### 2. Two Visualization Modes

#### Individual Markers Mode
- Shows each record as a separate pin on the map
- Click any marker to see record details in a popup
- Best for datasets with < 1000 locations
- Blue circle markers with hover effects

#### Clustered Heatmap Mode
- Groups nearby locations into clusters
- Cluster size and color indicate density:
  - 🔴 Red (100+): Very high density
  - 🟠 Orange (50-99): High density
  - 🟡 Yellow (20-49): Medium-high density
  - 🟢 Lime (10-19): Medium density
  - 🔵 Green (5-9): Low-medium density
  - ⚪ Light green (1-4): Low density
- Click clusters to see sample records
- Ideal for large datasets with geographic clustering

### 3. Geographic Statistics

The map interface shows comprehensive statistics:
- **Total Locations**: Number of records with valid coordinates
- **Unique Clusters**: Geographic groups based on proximity
- **Cities/Areas**: Count of distinct location names
- **Average per Cluster**: Distribution metric
- **Top Locations**: Breakdown by city/area with counts

### 4. Smart Auto-Zoom & Centering
- Automatically calculates optimal map bounds based on your data
- Centers the map on the geographic centroid
- Adjusts zoom level to show all your data points

## How to Use

### Step 1: Enable Geo-Search
1. Go to the **Config** tab
2. Select your table
3. Enable "Geo-Location Search"
4. Configure:
   - Latitude field (e.g., `latitude`, `lat`)
   - Longitude field (e.g., `longitude`, `lng`, `lon`)
   - Location name field (optional, e.g., `city`, `location`)
5. Save configuration

### Step 2: Build Search Index
1. Click "Build Index" button
2. Wait for indexing to complete
3. Geo data is automatically indexed alongside text data

### Step 3: View on Map
1. Go to the **Map** tab
2. Select your table from dropdown
3. Choose view mode:
   - **Individual Markers**: See each location separately
   - **Clustered Heatmap**: View density distribution
4. Explore the map!

## Use Cases

### 1. Service Coverage Analysis
Visualize where your services are distributed geographically:
```
Example: 3,268 services across India
- Mumbai: 450 services
- Delhi: 380 services
- Bangalore: 320 services
- Nashik: 150 services
```

### 2. Customer Distribution
See where your customers are located:
- Identify high-density regions
- Find underserved areas
- Plan expansion strategies

### 3. Store/Branch Network
Map your physical locations:
- View all store locations at once
- Identify coverage gaps
- Optimize logistics routes

### 4. Event Locations
Display events across regions:
- Color-coded by density
- Filter by geographic bounds
- Show event details on click

### 5. Asset Tracking
Monitor field assets or equipment:
- Real-time location visualization
- Geographic clustering analysis
- Regional distribution metrics

## API Endpoint

The map uses a dedicated geo data endpoint:

### GET `/api/search/[table]/geo`

**Query Parameters:**
- `limit` (optional): Maximum records to fetch (default: 1000)
- `bounds` (optional): Filter by map bounds: "lat1,lng1,lat2,lng2"

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "service_id": 1,
      "title": "Bus Service",
      "city": "Nashik",
      "_latitude": 19.9975,
      "_longitude": 73.7898,
      "_location": "nashik"
    }
  ],
  "total": 3268,
  "config": {
    "latField": "latitude",
    "lngField": "longitude",
    "locationField": "city"
  },
  "stats": {
    "totalRecords": 3268,
    "locationBreakdown": {
      "nashik": 150,
      "mumbai": 450
    },
    "bounds": {
      "north": 28.7041,
      "south": 8.0883,
      "east": 97.4025,
      "west": 68.1766
    }
  }
}
```

## Technical Details

### Libraries Used
- **Leaflet**: Open-source JavaScript library for interactive maps
- **React Leaflet**: React components for Leaflet
- **OpenStreetMap**: Free tile provider (no API key required!)

### Performance Optimizations
1. **Client-side Rendering**: Map components use `dynamic` import with SSR disabled
2. **Smart Clustering**: Groups nearby points to reduce DOM elements
3. **Lazy Loading**: Map loads only when tab is viewed
4. **Bounds Filtering**: Optional API parameter to fetch only visible data

### Data Requirements
- Valid latitude: -90 to 90
- Valid longitude: -180 to 180
- Records with invalid coordinates are filtered out
- Empty/null coordinates are skipped

## Customization

### Change Map Tiles
Edit [geo-map.tsx:177](../components/features/geo-map.tsx#L177) to use different tile providers:

```tsx
// Satellite view
url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"

// Dark mode
url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"

// Terrain
url="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png"
```

### Adjust Cluster Colors
Modify [geo-map.tsx:92-99](../components/features/geo-map.tsx#L92-L99):

```tsx
const getClusterColor = (count: number) => {
  if (count >= 100) return '#dc2626'; // Change to your color
  // ... customize thresholds and colors
};
```

### Change Marker Styles
Edit [geo-map.tsx:181-189](../components/features/geo-map.tsx#L181-L189):

```tsx
pathOptions={{
  fillColor: '#3b82f6', // Marker fill color
  color: '#1e40af',     // Marker border color
  weight: 1,            // Border width
  opacity: 1,           // Border opacity
  fillOpacity: 0.6,     // Fill opacity
}}
```

## Troubleshooting

### Map Not Loading
- Check browser console for errors
- Ensure Leaflet CSS is loaded (check Network tab)
- Verify table has geo-search enabled in Config tab

### No Data Showing
- Confirm table has records with valid lat/lng values
- Check that geo fields are correctly configured
- Try refreshing the data with the Refresh button

### Markers Not Clustered
- Switch to "Clustered Heatmap" view mode
- Ensure you have multiple records at similar coordinates
- Clustering is automatic based on proximity

### Performance Issues
- Reduce `limit` parameter in API (default 1000)
- Use Clustered Heatmap mode for large datasets
- Consider adding bounds filtering

## Future Enhancements

Potential features for future versions:
- [ ] Draw radius/polygon on map to filter search results
- [ ] Export map as image/PDF
- [ ] Custom marker icons based on record type
- [ ] Real-time location updates (WebSocket)
- [ ] Route planning between locations
- [ ] Geographic analytics (avg distance, density maps)
- [ ] Integration with search filters
- [ ] Multiple table overlay comparison
- [ ] Time-series animation (show changes over time)

## Related Documentation
- [Geo-Search Admin UI Guide](./GEO_SEARCH_ADMIN_UI.md)
- [Search Configuration](../README.md#search-configuration)
- [API Documentation](../README.md#api-reference)
