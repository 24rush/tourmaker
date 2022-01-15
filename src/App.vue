<script>
import { Map, View } from "ol";
import TileLayer from "ol/layer/Tile";
import VectorLayer from "ol/layer/Vector";
import OSM from "ol/source/OSM";
import Vector from "ol/source/Vector";
import Feature from "ol/Feature";
import Style from "ol/style/Style";
import Icon from "ol/style/Icon";
import Stroke from "ol/style/Stroke";
import Fill from "ol/style/Fill";
import Point from "ol/geom/Point";

import * as proj from "ol/proj";
import * as geom from "ol/geom";
import GPXProcessor from "./js/gpx.js";

let baseFeaturesCount = 0;

let FeatureType = {
  BaseLayer: 0,
  Overlap: 1,
  Direction: 2,
};

Object.freeze(FeatureType);

class RouteMapFeature {
  constructor(id, map) {
    this.id = id;
    this._map = map;

    let hueStartAngle = 150;
    let hueEndAngle = 320;
    let hueIncrements = 30;
    let colorSpaces = Math.floor((hueEndAngle - hueStartAngle) / hueIncrements);
    let hue =
      hueStartAngle +
      hueStartAngle * Math.floor(baseFeaturesCount / colorSpaces) +
      hueIncrements * (baseFeaturesCount % colorSpaces);

    this.baseLayerColor = this.HSLToRGB(hue, 52, 50);
    this.extraFeatureLayerColor = "rgb(255, 0, 0)";
    this.style = new Style({
      stroke: new Stroke({
        color: this.baseLayerColor,
        width: 4,
      }),
    });
    this.overlapStyle = new Style({
      stroke: new Stroke({
        color: this.extraFeatureLayerColor,
        width: 4,
      }),
    });

    this.features = [new Feature({})];
    this.features[0].setStyle(this.style);
    this.vectorSources = [new Vector({})];
    this.vectorSources[0].addFeature(this.features[0]);
    this.vectorLayers = [new VectorLayer({})];
    this.vectorLayers[0].setSource(this.vectorSources[0]);
    this.vectorLayers[0].setZIndex(this.vectorLayers.length);

    this._map.addLayer(this.vectorLayers[0]);
    baseFeaturesCount += 1;
  }

  createFeature(style, type = FeatureType.BaseLayer) {
    let feature = new Feature({});
    if (style) feature.setStyle(style);

    let vectorSource = new Vector({});
    vectorSource.addFeature(feature);

    let vectorLayer = new VectorLayer({});
    vectorLayer.setSource(vectorSource);
    vectorLayer.setZIndex(this.vectorLayers.length + 1);
    vectorLayer.type = type;

    this.vectorSources.push(vectorSource);
    this.vectorLayers.push(vectorLayer);
    this.features.push(feature);

    this._map.addLayer(vectorLayer);
    return feature;
  }

  createPointsArray(pointsLngLat) {
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

    return [points];
  }

  createLineStrings(pointsLngLat) {
    var lineStrings = [];

    for (var i = 0; i < pointsLngLat.length - 1; i++) {
      lineStrings.push(
        new geom.LineString([
          proj.transform(
            [pointsLngLat[i].lng, pointsLngLat[i].lat],
            "EPSG:4326",
            "EPSG:900913"
          ),
          proj.transform(
            [pointsLngLat[i + 1].lng, pointsLngLat[i + 1].lat],
            "EPSG:4326",
            "EPSG:900913"
          ),
        ])
      );
    }

    return lineStrings;
  }

  updatePoints(pointsLngLat) {
    if (pointsLngLat.length <= 1) return;

    this.features[0].setGeometry(
      new geom.MultiLineString(this.createPointsArray(pointsLngLat))
    );

    let distanceFromPrevious = 0.0;
    for (var i = 1; i < pointsLngLat.length; i++) {
      let start = pointsLngLat[i - 1];
      let end = pointsLngLat[i];

      distanceFromPrevious += (1000 * GPXProcessor.distanceBetweenPoints(
        end,
        start
      ));
      if (distanceFromPrevious < 20000) { // 20 KM
        continue;
      }
      
      distanceFromPrevious = 0.0;      

      const dx = end.lng - start.lng;
      const dy = end.lat - start.lat;

      const rotation = Math.atan2(dy, dx);

      let feature = this.createFeature(
        new Style(
          {
            image: new Icon({
              src: "public/arrow.png",
              anchor: [0.5, 0.5],
              rotateWithView: true,
              rotation: -rotation,
            }),
          },
          FeatureType.Direction
        )
      );

      feature.setGeometry(
        new Point(
          proj.transform([end.lng, end.lat], "EPSG:4326", "EPSG:900913")
        )
      );
    }
  }

  drawPoints(pointsLngLatArrays) {
    pointsLngLatArrays.forEach((latLngArray) => {
      let feature = this.createFeature(this.overlapStyle, FeatureType.Overlap);
      feature.setGeometry(
        new geom.MultiLineString(this.createPointsArray(latLngArray))
      );
    });
  }

  clearOverlapFeatures() {
    this.vectorLayers.forEach((vl) => {
      if (vl.type == FeatureType.Overlap) this._map.removeLayer(vl);
    });
  }

  getBaseFeatureVectorLayer() {
    return this.vectorLayers.find(vl => vl.type == FeatureType.BaseLayer);
  }

  show() {
    this.vectorLayers.forEach((vl) => {
      vl.setVisible(true);
    });
  }
  hide() {
    this.vectorLayers.forEach((vl) => {
      vl.setVisible(false);
    });
  }
  remove() {
    this.vectorLayers.forEach((vl) => {
      this._map.removeLayer(vl);
    });
    baseFeaturesCount--;
  }

  increaseStrokeWidth() {
    this.style.getStroke().setWidth(6);
    this.overlapStyle.getStroke().setWidth(6);

    this.features.forEach((f) => f.changed());
  }

  decreaseStrokeWidth() {
    this.style.getStroke().setWidth(4);
    this.overlapStyle.getStroke().setWidth(4);

    this.features.forEach((f) => f.changed());
  }

  HSLToRGB(h, s, l) {
    s /= 100;
    l /= 100;

    let c = (1 - Math.abs(2 * l - 1)) * s,
      x = c * (1 - Math.abs(((h / 60) % 2) - 1)),
      m = l - c / 2,
      r = 0,
      g = 0,
      b = 0;

    if (0 <= h && h < 60) {
      r = c;
      g = x;
      b = 0;
    } else if (60 <= h && h < 120) {
      r = x;
      g = c;
      b = 0;
    } else if (120 <= h && h < 180) {
      r = 0;
      g = c;
      b = x;
    } else if (180 <= h && h < 240) {
      r = 0;
      g = x;
      b = c;
    } else if (240 <= h && h < 300) {
      r = x;
      g = 0;
      b = c;
    } else if (300 <= h && h < 360) {
      r = c;
      g = 0;
      b = x;
    }
    r = Math.round((r + m) * 255);
    g = Math.round((g + m) * 255);
    b = Math.round((b + m) * 255);

    return "rgb(" + r + "," + g + "," + b + ")";
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
      zIndex: 9999,
      source: new Vector({
        projection: "EPSG:4326",
        features: [new Feature(this.pinCircle)],
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

  createRouteIfNotExist(id) {
    let route = this.getRoute(id);

    if (!route) {
      route = new RouteMapFeature(id, this.map);
      this.routeList[id] = route;
    }

    return route;
  }

  updateRoutePoints(id, pointsArr) {
    let route = this.createRouteIfNotExist(id);
    route.updatePoints(pointsArr);
  }

  updateRouteOverlaps(id, pointsArrArr) {
    let route = this.createRouteIfNotExist(id);
    route.clearOverlapFeatures();
    route.drawPoints(pointsArrArr);
  }

  removeRoute(id) {
    let route = this.getRoute(id);
    if (!route) return;

    route.remove();
    delete this.routeList[id];

    if (Object.keys(this.routeList).length == 1)
      this.routeList[Object.keys(this.routeList)[0]].clearOverlapFeatures();
  }

  setRouteVisibility(id, visibility) {
    let route = this.getRoute(id);
    if (!route) return;

    visibility ? this.getRoute(id).show() : this.getRoute(id).hide();
  }

  setPinVisibility(visibility) {
    if (this.pinVisible == visibility) return;
    this.pinVisible = visibility;

    this.pinVisible
      ? this.map.addLayer(this.movingPin)
      : this.map.removeLayer(this.movingPin);
  }

  movePinTo(point) {
    if (!point) {
      this.setPinVisibility(false);
      return;
    }

    this.pinCircle.setCenter(proj.fromLonLat([point.lng, point.lat]));
    this.setPinVisibility(true);
  }

  highlightRoute(id, state) {
    let route = this.getRoute(id);
    if (!route) return;

    if (state) route.increaseStrokeWidth();
    else route.decreaseStrokeWidth();
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
    onSetRouteInCenterView({ point }) {
      this.olMap.centerMap(point);
    },
    onMovePin({ point }) {
      this.olMap.movePinTo(point);
    },
    onHighlightRoute({ id, state }) {
      this.olMap.highlightRoute(id, state);
    },
    onUpdateRouteOverlaps({ id, points }) {
      this.olMap.updateRouteOverlaps(id, points);
    },
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
    @onUpdateRouteOverlaps="onUpdateRouteOverlaps"
    @onShowRouteOnMap="onShowRouteOnMap"
    @onDeleteDay="onDeleteDay"
    @onSetRouteInCenterView="onSetRouteInCenterView"
    @onMovePin="onMovePin"
    @onHighlightRoute="onHighlightRoute"
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
