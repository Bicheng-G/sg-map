<template>
  <div id="app">
    <div v-if='placeFound'>
      <div class='controls'>
        <a href="#" class='print-button' @click.prevent='toggleSettings'>Customize...</a>
      </div>
      <div v-if='showSettings' class='print-window'>
        <h3>Display</h3>
        <div class='row'>
          <div class='col'>Colors</div>
          <div class='col colors c-2'>
            <div v-for='layer in layers' :key='layer.name' class='color-container'>
              <color-picker v-model='layer.color' @change='layer.changeColor'></color-picker>
              <div class='color-label'>{{layer.name}}</div>
            </div>
          </div>
        </div>

        <h3>Export</h3>
        <div class='row'>
          <a href='#' @click.prevent='zazzleMugPrint()' class='col'>Onto a mug</a> 
          <span class='col c-2'>
            Print what you see onto a mug. <br/>Get a unique gift of your favorite city.
          </span>
        </div>
        <div class='preview-actions message' v-if='zazzleLink || generatingPreview'>
            <div v-if='zazzleLink' class='padded popup-help'>
              If your browser has blocked the new window, <br/>please <a :href='zazzleLink' target='_blank'>click here</a>
              to open it.
            </div>
            <div v-if='generatingPreview' class='loading-container'>
              <loading-icon></loading-icon>
              Generating preview url...
            </div>
        </div>
        <div class='row'>
          <a href='#'  @click.prevent='toPNGFile' class='col'>As an image (.png)</a> 
          <span class='col c-2'>
            Save the current screen as a raster image.
          </span>
        </div>
        
        <div class='row'>
          <a href='#'  @click.prevent='toSVGFile' class='col'>As a vector (.svg)</a> 
          <span class='col c-2'>
            Save the current screen as a vector image.
          </span>
        </div>
        <div v-if='false' class='row'>
          <a href='#' @click.prevent='toProtobuf' class='col'>To a .PBF file</a> 
          <span class='col c-2'>
            Save the current data as a protobuf message. For developer use only.
          </span>
        </div>

        <h3>About</h3>
        <div>
          <p>This website was created by <a href='https://twitter.com/anvaka' target='_blank'>@anvaka</a>.
          It downloads roads from OpenStreetMap and renders them with WebGL.
          </p>
          <p>
           You can find the entire <a href='https://github.com/anvaka/city-roads'>source code here</a>. 
           If you love this website you can also <a href='https://www.paypal.com/paypalme2/anvakos/3'>buy me a coffee</a> or 
           <a href='https://www.patreon.com/anvaka'>support me on Patreon</a>, but you don't have to.
          </p>
        </div>
      </div>
    </div>
  </div>

  <editable-label v-if='placeFound' v-model='name' class='city-name' :printable='true' :style='{color: labelColorRGBA}' :overlay-manager='overlayManager'></editable-label>
  <div v-if='placeFound' class='license printable can-drag' :style='{color: labelColorRGBA}'>data <a href='https://www.openstreetmap.org/about/' target="_blank" :style='{color: labelColorRGBA}'>© OpenStreetMap</a></div>
</template>

<script>
import LoadingIcon from './components/LoadingIcon.vue';
import EditableLabel from './components/EditableLabel.vue';
import ColorPicker from './components/ColorPicker.vue';
import createScene from './lib/createScene.js';
import GridLayer from './lib/GridLayer.js';
import generateZazzleLink from './lib/getZazzleLink.js';
import appState from './lib/appState.js';
import {getPrintableCanvas, getCanvas} from './lib/saveFile.js';
import config from './config.js';
import './lib/canvas2BlobPolyfill.js';
import bus from './lib/bus.js';
import createOverlayManager from './createOverlayManager.js';
import tinycolor from 'tinycolor2';
import Grid from './lib/Grid.js';
import BoundingBox from './lib/BoundingBox.js';
import {geoMercator} from 'd3-geo';

class ColorLayer {
  constructor(name, color, callback) {
    this.name = name;
    this.changeColor = callback;
    this.color = color;
  }
}

export default {
  name: 'App',
  components: {
    LoadingIcon,
    EditableLabel,
    ColorPicker
  },
  data() {
    return {
      placeFound: false,
      name: 'Singapore',
      zazzleLink: null,
      generatingPreview: false,
      showSettings: false,
      settingsOpen: false,
      labelColor: config.getLabelColor().toRgb(),
      backgroundColor: config.getBackgroundColor().toRgb(),
      layers: [],
      loadError: null,
      dataWorker: null
    }
  },
  computed: {
    labelColorRGBA() {
      return toRGBA(this.labelColor);
    }
  },
  created() {
    bus.on('scene-transform', this.handleSceneTransform);
    bus.on('background-color', this.syncBackground);
    bus.on('line-color', this.syncLineColor);
    this.overlayManager = createOverlayManager();
    this.loadSingaporeData();
  },
  beforeUnmount() {
    this.overlayManager.dispose();
    this.dispose();
    bus.off('scene-transform', this.handleSceneTransform);
    bus.off('background-color', this.syncBackground);
    bus.off('line-color', this.syncLineColor);
    if (this.dataWorker) {
      this.dataWorker.terminate();
    }
  },
  methods: {
    dispose() {
      if (this.scene) {
        this.scene.dispose();
        window.scene = null;
      }
    },
    toggleSettings() {
      this.showSettings = !this.showSettings;
    },
    handleSceneTransform() {
      this.zazzleLink = null;
    },
    loadSingaporeData() {
      console.log('[Main] Initializing data worker to load Singapore data...');
      
      const loaderElement = document.getElementById('simple-loader');
      if (loaderElement) {
        loaderElement.classList.remove('hidden'); // Ensure it's visible at start
      }
      
      this.dataWorker = new Worker(new URL('./lib/data.worker.js', import.meta.url), { type: 'module' });

      this.dataWorker.onmessage = (event) => {
        const { type, gridData, error } = event.data;
        if (type === 'SUCCESS') {
          console.log('[Main] Received processed grid data from worker:', gridData);
          this.onGridLoaded(gridData);
        } else if (type === 'ERROR') {
          console.error('[Main] Error from data worker:', error);
          this.loadError = `Error loading data: ${error}`;
          this.placeFound = false;
          if (loaderElement) {
            loaderElement.classList.add('hidden'); // Hide on error
          }
        }
      };

      this.dataWorker.onerror = (error) => {
        console.error('[Main] Worker error event:', error);
        this.loadError = `Worker error: ${error.message}`;
        this.placeFound = false;
        if (loaderElement) {
          loaderElement.classList.add('hidden'); // Hide on error
        }
      };

      const initialGridProperties = {
        name: 'Singapore',
        id: 3617140517,
        isArea: true
      };

      this.dataWorker.postMessage({ 
        dataUrl: '/data/singapore/singapore_roads.json',
        initialGridData: initialGridProperties
      });
    },
    onGridLoaded(dataFromWorker) {
      console.log('[Main] Grid loaded, initializing scene with data:', dataFromWorker);

      const finalGrid = new Grid();
      finalGrid.name = dataFromWorker.name;
      finalGrid.id = dataFromWorker.id;
      finalGrid.isArea = dataFromWorker.isArea;
      finalGrid.wayPointCount = dataFromWorker.wayPointCount;
      finalGrid.elements = dataFromWorker.rawElements;
      finalGrid.nodes = new Map(dataFromWorker.nodes);
      
      const boundsInstance = new BoundingBox();
      boundsInstance.minX = dataFromWorker.bounds.minX;
      boundsInstance.minY = dataFromWorker.bounds.minY;
      boundsInstance.maxX = dataFromWorker.bounds.maxX;
      boundsInstance.maxY = dataFromWorker.bounds.maxY;
      finalGrid.bounds = boundsInstance;

      if (finalGrid.isArea) {
        appState.set('areaId', finalGrid.id);
        appState.unset('osm_id');
        appState.unset('bbox');
      } else if (finalGrid.bboxString) {
        appState.unset('areaId');
        appState.set('osm_id', finalGrid.id);
        appState.set('bbox', dataFromWorker.bboxString);
      }
      this.placeFound = true;
      this.name = finalGrid.name.split(',')[0];
      let canvas = getCanvas();
      canvas.style.visibility = 'visible';

      this.scene = createScene(canvas);
      this.scene.on('layer-added', this.updateLayers);
      this.scene.on('layer-removed', this.updateLayers);

      window.scene = this.scene;

      let gridLayer = new GridLayer();
      gridLayer.id = 'lines';
      gridLayer.setGrid(finalGrid);
      this.scene.add(gridLayer);

      // Hide the loader now that the scene is set up
      const loaderElement = document.getElementById('simple-loader');
      if (loaderElement) {
        loaderElement.classList.add('hidden');
      }
    },

    startOver() {
      appState.unset('areaId');
      appState.unsetPlace();
      appState.unset('q');
      appState.enableCache();

      this.dispose();
      this.placeFound = false;
      this.zazzleLink = null;
      this.showSettings = false;
      this.backgroundColor = config.getBackgroundColor().toRgb();
      this.labelColor = config.getLabelColor().toRgb();

      document.body.style.backgroundColor = config.getBackgroundColor().toRgbString();
      getCanvas().style.visibility = 'hidden';
    },

    toPNGFile(e) {
      scene.saveToPNG(this.name)
    },

    toSVGFile(e) { 
      scene.saveToSVG(this.name)
    },

    updateLayers() {
      let newLayers = [];
      let lastLayer = 0;
      let renderer = this.scene.getRenderer();
      let root = renderer.getRoot();
      root.children.forEach(layer => {
        if (!layer.color) return;
        let name = layer.id;
        if (!name) {
          lastLayer += 1;
          name = 'lines ' + lastLayer;
        }
        let layerColor = tinycolor.fromRatio(layer.color);
        newLayers.push(new ColorLayer(name, layerColor, newColor => {
          this.zazzleLink = null;
          layer.color = toRatioColor(newColor);
          renderer.renderFrame();
          this.scene.fire('color-change', layer);
        }));
      });

      newLayers.push(
        new ColorLayer('background', this.backgroundColor, this.setBackgroundColor),
        new ColorLayer('labels', this.labelColor, newColor => this.labelColor = newColor)
      );

      this.layers = newLayers;

      function toRatioColor(c) {
        return {r: c.r/0xff, g: c.g/0xff, b: c.b/0xff, a: c.a}
      }
      this.zazzleLink = null;
    },

    syncLineColor() {
      this.updateLayers();
    },

    syncBackground(newBackground) {
      this.backgroundColor = newBackground.toRgb();
      this.updateLayers()
    },
    updateBackground() {
      this.setBackgroundColor(this.backgroundColor)
      this.zazzleLink = null;
    },
    setBackgroundColor(c) {
      this.scene.background = c;
      document.body.style.backgroundColor = toRGBA(c);
      this.zazzleLink = null;
    },

    zazzleMugPrint() {
      if (this.zazzleLink) {
        window.open(this.zazzleLink, '_blank');
        recordOpenClick(this.zazzleLink);
        return;
      }

      this.generatingPreview = true;
      getPrintableCanvas(this.scene).then(printableCanvas => {
        generateZazzleLink(printableCanvas).then(link => {
          this.zazzleLink = link;
          window.open(link, '_blank');
          recordOpenClick(link);
          this.generatingPreview = false;
        }).catch(e => {
          this.error = e;
          this.generatingPreview = false;
        });
      });
    }
  }
}

function toRGBA(c) {
    return `rgba(${c.r}, ${c.g}, ${c.b}, ${c.a})`;
}

function recordOpenClick(link) {
  if (typeof gtag === 'undefined') return;

  gtag('event', 'click', {
    'event_category': 'Outbound Link',
    'event_label': link
  });
}
</script>

<style lang='stylus'>
@import('./vars.styl');

#app {
  margin: 8px;
  max-height: 100vh;
  position: absolute;
  z-index: 1;
  h3 {
    font-weight: normal;
  }
}

.can-drag {
  border: 1px solid transparent;
}

.drag-overlay {
  position: fixed;
  background: transparent;
  left: 0;
  top: 0;
  right: 0;
  bottom: 0;
}

.overlay-active {
  border: 1px dashed highlight-color;
}
.overlay-active.exclusive {
  border-style: solid;
}

.controls {
  height: 48px;
  background: white;
  display: flex;
  flex-direction: row;
  align-items: stretch;
  width: desktop-controls-width;
  justify-content: space-around;
  box-shadow: 0 2px 4px rgba(0,0,0,0.2), 0 -1px 0px rgba(0,0,0,0.02);

  a {
    text-decoration: none;
    display: flex;
    justify-content: center;
    align-items: center;
    color: highlight-color;
    margin: 0;
    border: 0;
    &:hover {
      color: emphasis-background;
      background: highlight-color;
    }
  }
  a.try-another {
    flex: 1;
  }

  a.print-button {
    flex: 1;
    border-right: 1px solid border-color;
    &:focus {
      border: 1px dashed highlight-color;
    }
  }
}

.col {
    display: flex;
    flex: 1;
    select {
      margin-left: 14px;
    }
  }
.row {
  margin-top: 4px;
  display: flex;
  flex-direction: row;
  min-height: 32px;
}
.colors {
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;

  .color-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 64px;
  }

  .color-label {
    font-size: 12px;
  }
}

a {
  border: 1px solid transparent;
  margin: -1px;
  text-decoration: none;
  color: highlight-color
}
a:focus {
  border: 1px dashed highlight-color;
  outline: none;
}
.print-window {
  max-height: calc(100vh - 48px);
  overflow-y: auto;
  border-top: 1px solid border-color;
  background: white;
  box-shadow: 0 2px 4px rgba(0,0,0,0.2);
  width: desktop-controls-width;
  padding: 8px;
  .row a {
    margin-right: 4px;
  }

  h3 {
    margin: 8px 0;
    text-align: right;
  }
}

.message {
  border-top: 1px solid border-color
  border-bottom: 1px solid border-color
  background: #F5F5F5;
}

.preview-actions {
  display: flex;
  padding: 8px 0;
  margin-left: -8px;
  margin-bottom: 14px;
  margin-top: 1px;
  width: desktop-controls-width;
  flex-direction: column;
  align-items: stretch;
  font-size: 14px;
  align-items: center;
  display: flex;

  .popup-help {
    text-align: center;
  }
}

.city-name {
  position: absolute;
  right: 32px;
  bottom: 54px;
  font-size: 24px;
  color: #434343;
  input {
    font-size: 24px;
  }
}

.license {
  text-align: right;
  position: fixed;
  font-family: labels-font;
  right: 32px;
  bottom: 32px;
  font-size: 12px;
  padding-right: 8px;
  a {
    text-decoration: none;
    display: inline-block;
  }
}

.c-2 {
  flex: 2
}

@media (max-width: small-screen) {
  #app {
    width: 100%;
    margin: 0;

    .preview-actions,.error,
    .controls, .print-window {
      width: 100%;
    }
    .loading-container {
      font-size: 12px;
    }

    .print-window {
      font-size: 14px;
    }

  }
  .city-name  {
    right: 8px;
    bottom: 24px;
  }
  .license  {
    right: 8px;
    bottom: 8px;
  }
}

</style>
