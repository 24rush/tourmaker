<script>
import { Map, View } from "ol";
import TileLayer from "ol/layer/Tile";
import VectorLayer from "ol/layer/Vector";
import OSM from "ol/source/OSM";
import Vector from "ol/source/Vector";
import Feature from "ol/Feature";
import Style from "ol/style/Style";
import Stroke from "ol/style/Stroke";
import Fill from "ol/style/Fill";

import * as proj from "ol/proj";
import * as geom from "ol/geom";

class RouteMapFeature {
  constructor(id) {
    this.id = id;
    this.geometry = {};
    this.vectorSource = new Vector({});

    this.style = new Style({
      stroke: new Stroke({
        color: "rgba(0, 139, 236, 0.8)",
        width: 4,
      }),
    });

    this.feature = new Feature({});
    this.feature.setStyle(this.style);
    this.vectorSource.addFeature(this.feature);
    this.vectorLayer = new VectorLayer({});
    this.vectorLayer.setSource(this.vectorSource);
  }

  updatePoints(pointsLngLat) {
    var points = [];
    for (var i = 0; i < pointsLngLat.length; i++) {
      points.push(
        proj.transform(
          [pointsLngLat[i].lng, pointsLngLat[i].lat],
          "EPSG:4326",
          "EPSG:900913"
        )
      );
    }

    this.feature.setGeometry(new geom.MultiLineString([points]));
  }

  getVectorLayer() {
    return this.vectorLayer;
  }

  show() {
    this.vectorLayer.setVisible(true);
  }
  hide() {
    this.vectorLayer.setVisible(false);
  }
}

class OLMap {
  constructor(targetId) {
    this.routeList = {};
    this.pinVisible = false;
    this.pinCircle = new geom.Circle(proj.fromLonLat([-5.166461, 36.74]), 200);

    this.map = new Map({
      target: targetId,
      layers: [
        new TileLayer({
          source: new OSM(),
        }),
      ],
      view: new View({
        center: proj.transform([-5.166461, 36.74], "EPSG:4326", "EPSG:900913"),
        zoom: 12,
      }),
    });

    this.movingPin = new VectorLayer({
      source: new Vector({
        projection: "EPSG:4326",
        features: [
          new Feature(this.pinCircle),
        ],
      }),
      style: [
        new Style({
          stroke: new Stroke({
            color: "white",
            width: 1,
          }),
          fill: new Fill({
            color: "rgba(231, 109, 35, 1)",
          }),
        }),
      ],
    });
  }

  getRoute(id) {
    return id in this.routeList ? this.routeList[id] : undefined;
  }

  centerMap(point) {
    this.map.getView().animate({
      center: proj.transform(
        [point.lng, point.lat],
        "EPSG:4326",
        "EPSG:900913"
      ),
      duration: 500,
    });
  }

  updateRoutePoints(id, points) {
    let route = this.getRoute(id);

    if (!route) {
      route = new RouteMapFeature(id);
      this.routeList[id] = route;
      this.map.addLayer(this.routeList[id].getVectorLayer());
    }

    route.updatePoints(points);
  }

  removeRoute(id) {
    let route = this.getRoute(id);
    if (!route) return;

    this.map.removeLayer(route.getVectorLayer());
    delete this.routeList[id];
  }

  setRouteVisibility(id, visibility) {
    let route = this.getRoute(id);
    if (!route) return;

    visibility ? this.getRoute(id).show() : this.getRoute(id).hide();
  }

  setPinVisibility(visibility) {
    if (this.pinVisible == visibility) return;
    this.pinVisible = visibility;

    this.pinVisible ? this.map.addLayer(this.movingPin) : this.map.removeLayer(this.movingPin);
  }

  movePinTo(point) {
    if (!point) { this.setPinVisibility(false); return; }

    this.pinCircle.setCenter(proj.fromLonLat([point.lng, point.lat]));
    this.setPinVisibility(true);
  }
}

export default {
  data() {
    return {
      olMap: undefined,
    };
  },

  methods: {
    onUpdateRoutePoints({ id, points }) {
      this.olMap.updateRoutePoints(id, points);
    },
    onShowRouteOnMap({ id, show }) {
      this.olMap.setRouteVisibility(id, show);
    },
    onDeleteDay({ id }) {
      this.olMap.removeRoute(id);
    },
    onCenterMap({ point }) {
      this.olMap.centerMap(point);
    },
    onMovePin({ point }) {
      this.olMap.movePinTo(point);
    }
  },

  mounted() {
    this.olMap = new OLMap("map");
  },
};
</script>

<script setup>
import Route from "./components/Route.vue";
</script>

<template>
  <div id="map"></div>
  <Route
    @onUpdateRoutePoints="onUpdateRoutePoints"
    @onShowRouteOnMap="onShowRouteOnMap"
    @onDeleteDay="onDeleteDay"
    @onCenterMap="onCenterMap"
    @onMovePin="onMovePin"
  />
</template>

<style>
@import "bootstrap/dist/css/bootstrap.min.css";
@import "../node_modules/ol/ol.css";
@import "./assets/styles/sidebars.css";

#app {
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  margin-top: 60px;
}

#map {
  z-index: 0;
  position: absolute;
  top: 0;
  bottom: 0;
  width: 100%;
}
</style>
