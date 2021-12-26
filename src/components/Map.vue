<script>
import { Map, View } from "ol";
import TileLayer from "ol/layer/Tile";
import VectorLayer from "ol/layer/Vector";
import OSM from "ol/source/OSM";
import Vector from "ol/source/Vector";
import Feature from "ol/Feature";
import Style from "ol/style/Style";
import Stroke from "ol/style/Stroke";

import * as proj from "ol/proj";
import * as geom from "ol/geom";

var redStyle = new Style({
  stroke: new Stroke({
    color: "red",
    width: 3,
  }),
});

var vectorSource = new Vector({});

function loadMap() {
  const map = new Map({
    target: "map",
    layers: [
      new TileLayer({
        source: new OSM(),
      }),
      new VectorLayer({
        source: vectorSource,
      }),
    ],
    view: new View({
      center: proj.transform([-5.172173, 36.75], "EPSG:4326", "EPSG:900913"),
      zoom: 12,
    }),
  });
}

var items = [];

async function gpxLoaded() {
  items = await fetch("src/assets/gpx.json").then((response) =>
    response.json()
  );
  items = items.items;

  var points = [];
  for (var i = 0; i < items.length; i++) {
    var xx = items[i].lng;
    var yy = items[i].lat;
    points.push(proj.transform([xx, yy], "EPSG:4326", "EPSG:900913"));
  }

  var featurething = new Feature({
    geometry: new geom.MultiLineString([points]),
  });

  featurething.setStyle(redStyle);
  vectorSource.addFeature(featurething);
}

import { reactive } from "vue";

export default {
  mounted() {
    loadMap();
    gpxLoaded();
  },

  setup() {
    loadMap();
  },
};
</script>

<template>
  <div id="map"></div>
</template>

<style scoped>
#map {
  z-index: 0;
  position: absolute;
  top: 0;
  bottom: 0;
  width: 100%;
}
</style>
