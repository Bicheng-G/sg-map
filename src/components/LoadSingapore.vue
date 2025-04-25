<template>
  <div class='load-singapore'>
    <h3 class='site-header'>Singapore Roads</h3>
    <p class='description'>Loading Singapore's road network...</p>
    <p v-if='error' class='error'>{{ error }}</p>
  </div>
</template>

<script>
import Grid from '../lib/Grid.js';
import BoundingBox from '../lib/BoundingBox.js';
import {geoMercator} from 'd3-geo';

export default {
  name: 'LoadSingapore',
  data() {
    return {
      error: null
    }
  },
  mounted() {
    console.log('LoadSingapore component mounted');
    // Load Singapore data from our downloaded JSON file
    fetch('/data/singapore/singapore_roads.json')
      .then(response => {
        console.log('Response status:', response.status);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
      })
      .then(data => {
        console.log('Data loaded:', data);
        const grid = new Grid();
        grid.name = 'Singapore';
        grid.id = 3617140517; // Singapore's area ID
        grid.isArea = true;
        
        // Process the OSM data
        if (data.elements) {
          console.log('Processing elements:', data.elements.length);
          
          // First pass: collect all nodes
          const nodes = new Map();
          data.elements.forEach(element => {
            if (element.type === 'node') {
              nodes.set(element.id, element);
            }
          });
          grid.nodes = nodes;
          
          // Calculate bounds from the nodes
          const bounds = new BoundingBox();
          nodes.forEach(node => {
            bounds.addPoint(node.lon, node.lat);
          });
          grid.bounds = bounds;
          console.log('Bounds calculated:', bounds);

          // Set up the projection
          const projector = geoMercator()
            .center([bounds.cx, bounds.cy])
            .scale(6371393); // Radius of Earth
          grid.projector = projector;
          
          // Second pass: process ways and count way points
          let wayPointCount = 0;
          const ways = [];
          data.elements.forEach(element => {
            if (element.type === 'way' && element.tags && element.tags.highway) {
              ways.push(element);
              wayPointCount += element.nodes.length;
            }
          });
          grid.wayPointCount = wayPointCount;
          grid.elements = ways;
          
          console.log('Processed ways:', ways.length);
          console.log('Total way points:', wayPointCount);
        } else {
          throw new Error('No elements found in the data');
        }
        
        this.$emit('loaded', grid);
      })
      .catch(error => {
        console.error('Error loading Singapore data:', error);
        this.error = `Error loading data: ${error.message}`;
      });
  }
}
</script>

<style scoped>
.load-singapore {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100vh;
  text-align: center;
}

.site-header {
  font-size: 2em;
  margin-bottom: 1em;
}

.description {
  font-size: 1.2em;
  color: #666;
}

.error {
  color: red;
  margin-top: 1em;
}
</style> 