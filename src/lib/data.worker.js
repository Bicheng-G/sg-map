import { geoMercator } from 'd3-geo';
import Grid from './Grid.js'; // Use the actual Grid class
import BoundingBox from './BoundingBox.js'; // Use the actual BoundingBox class

// Placeholder for BoundingBox - REMOVED

// Placeholder for Grid - REMOVED

self.onmessage = async (event) => {
  const { dataUrl, initialGridData } = event.data; // Expect initialGridData for name, id etc.
  console.log('[Worker] Received request to load data from:', dataUrl);

  try {
    const response = await fetch(dataUrl);
    if (!response.ok) {
      throw new Error(`[Worker] HTTP error! status: ${response.status}`);
    }
    const osmData = await response.json(); // This parsing happens in the worker
    console.log('[Worker] Data fetched and parsed successfully.');

    // --- Processing logic using Grid.fromOSMResponse and its methods ---
    // The Grid.fromOSMResponse method already populates nodes and bounds.
    const grid = Grid.fromOSMResponse(osmData.elements);

    // Set additional properties that might have been passed or are defaults
    grid.setName(initialGridData.name || 'Singapore');
    grid.setId(initialGridData.id || 3617140517); // Example ID
    grid.setIsArea(initialGridData.isArea !== undefined ? initialGridData.isArea : true);

    console.log('[Worker] Grid instance created from OSM data.');
    console.log('[Worker] Bounds calculated by Grid.js:', grid.bounds);

    // The projector is initialized within Grid.js when getProjector() is called.
    // We need to decide if projection happens in worker or main thread.
    // For sending data back, it's often better to send raw data + projection params,
    // or fully projected data if the main thread doesn't need to re-project.

    // Let's adapt the logic to project coordinates for ways within the worker,
    // similar to the previous stub, but using the Grid's projector.
    const projector = grid.getProjector(); // This will create/get the projector

    const projectedWays = [];
    let wayPointCount = 0; // Recalculate as fromOSMResponse might just count raw waypoints

    grid.elements.forEach(element => {
      if (element.type === 'way' && element.tags && element.tags.highway) {
        const projectedNodeCoords = [];
        let currentWayPointCount = 0;
        if (element.nodes) {
          element.nodes.forEach(nodeId => {
            const node = grid.nodes.get(nodeId);
            if (node && node.lon !== undefined && node.lat !== undefined) {
              const projected = projector({ lon: node.lon, lat: node.lat });
              projectedNodeCoords.push([projected.x, projected.y]);
              currentWayPointCount++;
            }
          });
        }

        if (projectedNodeCoords.length > 1) { // A way needs at least 2 points
          projectedWays.push({
            id: element.id,
            tags: element.tags,
            // nodes: element.nodes, // original node IDs, might be useful
            projectedCoords: projectedNodeCoords // Store projected coordinates
          });
        }
        wayPointCount += currentWayPointCount; // Sum of actual nodes used in ways
      }
    });

    grid.wayPointCount = wayPointCount; // Update with count of projected waypoints
    // Replace original elements with ways that have projected coordinates
    // The original grid.elements contains all elements (nodes, ways, relations)
    // For rendering, we primarily need the projected ways.
    // grid.elements = projectedWays; // This changes structure, be careful how main thread uses it

    console.log('[Worker] Processed and projected ways:', projectedWays.length);
    console.log('[Worker] Total way points in processed ways:', wayPointCount);

    // Prepare data for postMessage - ensure it's serializable
    // The grid.nodes Map contains actual node objects. If sent, it's large.
    // The grid.bounds is an instance of BoundingBox. Send plain object.
    const serializableGridData = {
      name: grid.name,
      id: grid.id,
      isArea: grid.isArea,
      bounds: {
        minX: grid.bounds.minX, minY: grid.bounds.minY,
        maxX: grid.bounds.maxX, maxY: grid.bounds.maxY,
        cx: grid.bounds.cx, cy: grid.bounds.cy,
        // Include original lon/lat bounds if needed by main thread for projector setup
        originalMinLon: grid.bounds.minLon, // Assuming BoundingBox was adapted or these are set
        originalMinLat: grid.bounds.minLat,
        originalMaxLon: grid.bounds.maxLon,
        originalMaxLat: grid.bounds.maxLat
      },
      // elements: projectedWays, // Send only the processed ways with projected coords
      rawElements: grid.elements, // Send raw elements, main thread can process/project
      nodes: Array.from(grid.nodes.entries()), // Convert Map to array of [id, node] pairs
      wayPointCount: grid.wayPointCount,
      // Do not send projector function: grid.projector
    };

    self.postMessage({ type: 'SUCCESS', gridData: serializableGridData });

  } catch (error) {
    console.error('[Worker] Error loading or processing data:', error.message, error.stack);
    self.postMessage({ type: 'ERROR', error: error.message });
  }
}; 