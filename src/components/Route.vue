<script>
import GPXProcessor from "../js/gpx.js";
import VueApexCharts from "vue3-apexcharts";
import { createProjection } from "ol/proj";

let gpx = new GPXProcessor();
fetch("src/assets/gpx.json")
  .then((response) => response.json())
  .then((items) => {
    gpx.setPoints(items.items);
  });

async function tryLoadGPX(url) {
  let tourId = url.split("/").pop();
  let kommotUrl = `https://api.komoot.de/v007/tours/${tourId}/coordinates`;

  //"src/assets/gpx.json"
  return await fetch(kommotUrl).then((response) => response.json());
}

class DayRoute {
  constructor(context, id, index) {
    // Display
    this.id = id;
    this.index = index;
    this.title = "Day " + this.index;
    this.context = context;
    this.gpx_url = "";
    this.gpx_file_name = "";
    this.elevation = 0.0;
    this.distance = 0.0;
    this.showOnMap = true;
    this.edit = false;
    this.elevationPoints = [{}];

    // Private
    this._gpxProcessor = new GPXProcessor();

    this.chartOptions = {
      model: this,
      markers: {
        size: 0,
      },
      tooltip: {
        enabled: true,
        marker: { show: false },
        x: {
          formatter: function (val, opts) {
            return "Km " + Math.floor(val);
          },
        },
        shared: false,
        custom: function ({ series, seriesIndex, dataPointIndex, w }) {
          // Move pin on map
          context.onMovePinAtDistanceFromStart(
            w.config.model,
            w.globals.labels[dataPointIndex]
          );
          return "";
          /*'<div class="arrow_box">' +
            "<span>" +
            +Math.floor(
              w.config.model.getGradientAtDistanceFromStart(
                w.globals.labels[dataPointIndex]
              )
            ) +
            "</span>" +
            "</div>"*/
        },
      },
      chart: {
        animations: {
          enabled: false,
        },
        offsetY: 0,
        parentHeightOffset: -20,
        events: {
          model: this,
          mouseLeave: function (event, chartContext, config) {
            this.model.context.onMovePinAtDistanceFromStart(
              this.model,
              undefined
            );
          },
        },
      },
      colors: ["#e76d23"],
      yaxis: {
        labels: {
          formatter: function (value) {
            return Math.floor(value);
          },
          offsetX: -15,
        },
      },
      xaxis: {
        labels: {
          show: false,
        },
        tooltip: {
          enabled: false,
        },
      },
      dataLabels: {
        enabled: false,
      },
      stroke: {
        width: 1,
      },
      grid: {
        padding: {
          left: -10,
          bottom: -20,
        },
        strokeDashArray: 0.1,
      },
    };
  }

  setGPXPoints(points) {
    this._gpxProcessor.setPoints(points);
    this.elevation = this._gpxProcessor.getElevation();
    this.distance = this._gpxProcessor.getDistance();

    this.elevationPoints = [
      {
        name: "Altitude",
        data: this._gpxProcessor.getElevationPoints(),
      },
    ];
  }

  updateTitle(title) {
    this.title = "Day " + this.index + ": " + title;
  }

  getCenterPoint() {
    return this._gpxProcessor.getCenterPoint();
  }
  hasPoints() {
    return this._gpxProcessor.hasPoints;
  }
  getElevationRange() {
    return this._gpxProcessor.getElevationRange();
  }

  getLatLongAtDistanceFromStart(distanceFromStart) {
    return this._gpxProcessor.getLatLongAtDistanceFromStart(distanceFromStart);
  }
  getGradientAtDistanceFromStart(distanceFromStart) {
    return this._gpxProcessor.getGradientAtDistanceFromStart(distanceFromStart);
  }
  getLatLongAtIndexPosition(index) {
    return this._gpxProcessor.getLatLongAtIndexPosition(index);
  }
  getGradientAtIndexPosition(index) {
    return this._gpxProcessor.getGradientAtIndexPosition(index);
  }

  getDistanceOnFlat() {
    return (
      this.distance -
      (this.getDistanceOnMedHills() +
        this.getDistanceOnHighHills() +
        this.getDistanceOnDescent())
    );
  }
  getDistanceOnMedHills() {
    return this._gpxProcessor.getDistanceInGradientRange(2, 6);
  }
  getDistanceOnHighHills() {
    return this._gpxProcessor.getDistanceInGradientRange(7, 400);
  }
  getDistanceOnDescent() {
    return this._gpxProcessor.getDistanceInGradientRange(-40, -2);
  }
}

export default {
  components: {
    apexchart: VueApexCharts,
  },
  data() {
    return {
      nextDayId: 0,
      days: [],
      editedDay: null,
      totalDistance: function () {
        let total = 0;
        for (let i = 0; i < this.days.length; i++)
          total += this.days[i].distance;

        return total;
      },
      totalElevation: function () {
        let total = 0;
        for (let i = 0; i < this.days.length; i++)
          total += this.days[i].elevation;

        return total;
      },
    };
  },
  methods: {
    toStr: function (str, index) {
      return str + "-" + index;
    },
    addDay: function () {
      this.days.push(
        new DayRoute(this, this.nextDayId++, this.days.length + 1)
      );
    },
    removeDay: function (index) {
      let id = this.days[index].id;
      this.days.splice(index, 1);
      this.$emit("onDeleteDay", { id: id });
    },
    editDay: function (day) {
      this.editedDay = day;
    },

    onHighlight: function (day) {
      if (!day.showOnMap || !day.hasPoints()) return;
      this.$emit("onCenterMap", { point: day.getCenterPoint() });
    },
    updateDayFromGpx: function (day, file) {
      if (!file) {
        this.updateDayRoute(day, []);
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const parser = new DOMParser();
        const doc = parser.parseFromString(e.target.result, "application/xml");

        let gpx_points = doc.getElementsByTagName("trkpt");
        let points = [];
        for (var i = 0; i < gpx_points.length; i++) {
          let gpx_point = gpx_points[i];
          points.push({
            lat: parseFloat(gpx_point.getAttribute("lat")),
            lng: parseFloat(gpx_point.getAttribute("lon")),
            alt: parseFloat(
              gpx_point.getElementsByTagName("ele")[0].textContent
            ),
          });
        }

        day.gpx_file_name = file.name;
        day.updateTitle(day.gpx_file_name.replace(/\.[^/.]+$/, ""));
        this.updateDayRoute(day, points);
      };

      reader.catch = (e) => {
        this.updateDayRoute(day, []);
      };
      reader.readAsText(file);
    },
    uploadMultipleGPXs: function (event) {
      for (let index = 0; index < event.target.files.length; index++) {
        const file = event.target.files[index];

        this.addDay();
        let day = this.days[this.days.length - 1];
        this.updateDayFromGpx(day, file);
      }
    },
    selectedGPXFile: function (event, day) {
      console.log(event);
      const file = event.target.files[0];
      this.updateDayFromGpx(day, file);
    },

    updateDayRoute: function (day, points) {
      day.setGPXPoints(points);
      this.$emit("onUpdateRoutePoints", {
        id: day.id,
        points: points,
      });
      if (day.showOnMap && day.hasPoints()) {
        this.$emit("onCenterMap", { point: day.getCenterPoint() });
      } else {
        this.$emit("onShowRouteOnMap", { id: day.id, show: day.showOnMap });
      }
    },

    // Events
    onUpdateGPXURL: function (day) {
      if (!day.gpx_url) return;
      tryLoadGPX(day.gpx_url)
        .then((items) => {
          this.updateDayRoute(day, items.items);
        })
        .catch((error) => {
          alert("Cannot load: " + error);
        });
    },
    onShowRouteOnMap: function (day) {
      this.$emit("onShowRouteOnMap", { id: day.id, show: day.showOnMap });
    },
    onMovePinAtDistanceFromStart: function (day, distanceFromStart) {
      let latlngPoint = day.getLatLongAtDistanceFromStart(distanceFromStart);
      this.$emit("onMovePin", { point: latlngPoint });
    },
    onMovePinAtIndexPosition: function (day, index) {
      let latlngPoint = day.getLatLongAtIndexPosition(index);
      this.$emit("onMovePin", { point: latlngPoint });
    },
  },

  directives: {
    focus: {
      inserted(el) {
        el.focus();
      },
    },
  },

  mounted() {
    var div2 = document.getElementById("routeListContainer");
    var div = document.getElementById("routeListMain");
    var span = document.getElementById("routeListTitle");
    var span2 = document.getElementById("routeListTotals");

    var mousePosition;
    var offset = [0, 0];
    var isDown = false;

    div.addEventListener(
      "mousedown",
      function (e) {
        var clientWidth = parseInt(e.target.style.width);
        var clientHeight = parseInt(e.target.style.height);
        var isInResizeCorner =
          e.clientX > clientWidth - 15 || e.clientY > clientHeight - 15;

        if (
          (e.target == div ||
            e.target == span ||
            e.target == div2 ||
            e.target == span2 ||
            e.target.parentElement == span2) &&
          !isInResizeCorner
        ) {
          isDown = true;
          offset = [div.offsetLeft - e.clientX, div.offsetTop - e.clientY];
        }
      },
      true
    );

    document.addEventListener(
      "mouseup",
      function () {
        isDown = false;
      },
      true
    );

    document.addEventListener(
      "mousemove",
      function (event) {
        event.preventDefault();
        if (isDown) {
          mousePosition = {
            x: event.clientX,
            y: event.clientY,
          };
          div.style.left = mousePosition.x + offset[0] + "px";
          div.style.top = mousePosition.y + offset[1] + "px";
        }
      },
      true
    );
  },
};
</script>

<template>
  <div
    id="routeListMain"
    class="flex-shrink-0 p-3 bg-white"
    style="position: absolute; resize: both; overflow: auto"
  >
    <div
      id="routeListContainer"
      class="d-flex align-items-center pb-3 mb-3 link-dark border-bottom"
    >
      <span id="routeListTitle" style="cursor: move" class="fs-4 fw-semibold"
        >Tour days</span
      >

      <div
        id="routeListTotals"
        style="margin-left: 0.3em; margin-right: 0.5em; cursor: move"
      >
        <svg
          class="metric-icon"
          width="24px"
          height="24px"
          viewBox="0 0 36 36"
          id="template"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M30.311 28.112 20.234 9.85c-0.005 -0.009 -0.013 -0.014 -0.019 -0.023a0.3 0.3 0 0 0 -0.043 -0.051 0.372 0.372 0 0 0 -0.057 -0.048c-0.007 0 -0.012 -0.013 -0.02 -0.017a0.292 0.292 0 0 0 -0.036 -0.011 0.337 0.337 0 0 0 -0.068 -0.022 0.371 0.371 0 0 0 -0.067 -0.006 0.388 0.388 0 0 0 -0.067 0.006 0.4 0.4 0 0 0 -0.067 0.021 0.265 0.265 0 0 0 -0.037 0.012c-0.008 0 -0.013 0.013 -0.021 0.018a0.305 0.305 0 0 0 -0.055 0.046 0.365 0.365 0 0 0 -0.045 0.052c-0.005 0.009 -0.014 0.014 -0.019 0.023L13.807 20.374l-1.773 -3.212a0.2 0.2 0 0 0 -0.019 -0.022 0.357 0.357 0 0 0 -0.044 -0.052 0.31 0.31 0 0 0 -0.056 -0.047c-0.008 0 -0.012 -0.013 -0.02 -0.018s-0.025 -0.006 -0.037 -0.011a0.4 0.4 0 0 0 -0.067 -0.022 0.378 0.378 0 0 0 -0.067 0 0.371 0.371 0 0 0 -0.067 0 0.375 0.375 0 0 0 -0.067 0.022c-0.012 0 -0.026 0 -0.037 0.011s-0.013 0.013 -0.021 0.018a0.31 0.31 0 0 0 -0.056 0.047 0.432 0.432 0 0 0 -0.044 0.052c-0.005 0.008 -0.014 0.013 -0.019 0.022L7.805 23.7 6.454 21.255c0 -0.009 -0.013 -0.014 -0.019 -0.023a0.518 0.518 0 0 0 -0.044 -0.051 0.31 0.31 0 0 0 -0.056 -0.047c-0.008 0 -0.012 -0.013 -0.021 -0.018s-0.024 -0.006 -0.036 -0.011a0.309 0.309 0 0 0 -0.067 -0.022 0.379 0.379 0 0 0 -0.067 -0.006 0.321 0.321 0 0 0 -0.134 0.027c-0.012 0.005 -0.026 0.006 -0.037 0.012a0.2 0.2 0 0 0 -0.021 0.018 0.31 0.31 0 0 0 -0.056 0.047 0.358 0.358 0 0 0 -0.044 0.051c0 0.009 -0.014 0.014 -0.019 0.023L2.05 28.112a0.355 0.355 0 0 0 0.139 0.481 0.342 0.342 0 0 0 0.171 0.045 0.357 0.357 0 0 0 0.311 -0.183L6.144 22.16l1.35 2.448c0 0.007 0.012 0.01 0.016 0.016a0.337 0.337 0 0 0 0.1 0.1c0.007 0 0.012 0.012 0.019 0.016l0 0a0.354 0.354 0 0 0 0.342 0l0 0c0.008 0 0.012 -0.011 0.02 -0.016a0.345 0.345 0 0 0 0.1 -0.1c0 -0.006 0.012 -0.009 0.016 -0.016l3.609 -6.54 1.649 2.988c0.009 0.016 0.026 0.023 0.037 0.037L11.083 25.31a0.355 0.355 0 0 0 0.14 0.482 0.346 0.346 0 0 0 0.171 0.044 0.352 0.352 0 0 0 0.31 -0.183l8.22 -14.9 9.765 17.7a0.357 0.357 0 0 0 0.311 0.183 0.339 0.339 0 0 0 0.171 -0.045A0.355 0.355 0 0 0 30.311 28.112Z"
          />
        </svg>
        <span class="metric"> {{ this.totalElevation() }} m</span>

        <svg
          style="margin-left: 0.6em"
          class="metric-icon"
          width="24px"
          height="24px"
          viewBox="0 0 32 20"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            fill="#000"
            d="M4.34 0.985c-1.5 0 -3.003 1.125 -3.003 3.375L4.34 10.359l3 -6c0 -2.25 -1.5 -3.375 -3 -3.375zm13.233 1.828c-0.324 0.013 -0.637 0.076 -0.9 0.132l0.178 0.826c0.262 -0.059 0.535 -0.096 0.764 -0.112zM4.34 2.86c0.829 0 1.5 0.672 1.5 1.5 0 0.829 -0.67 1.5 -1.5 1.5 -0.828 0 -1.5 -0.67 -1.5 -1.5 0 -0.828 0.672 -1.5 1.5 -1.5zm14.165 0.01l-0.141 0.829c0.229 0.048 0.46 0.108 0.66 0.229l0.408 -0.741c-0.285 -0.153 -0.604 -0.29 -0.928 -0.319zm-2.696 0.315c-0.285 0.111 -0.572 0.212 -0.815 0.308L15.328 4.266c0.258 -0.109 0.53 -0.205 0.758 -0.285zM20.204 3.811L19.561 4.359c0.169 0.194 0.3 0.431 0.403 0.623l0.755 -0.38c-0.158 -0.307 -0.3 -0.54 -0.516 -0.792zm-5.99 0.042c-0.285 0.146 -0.52 0.276 -0.773 0.403l0.412 0.741c0.244 -0.141 0.511 -0.276 0.727 -0.384zm-1.515 0.839c-0.249 0.146 -0.492 0.292 -0.732 0.45l0.46 0.704c0.229 -0.15 0.468 -0.292 0.704 -0.431zM21.01 5.532c-0.276 0.047 -0.558 0.08 -0.835 0.112 0.019 0.235 0.004 0.488 -0.042 0.684l0.82 0.192c0.047 -0.338 0.089 -0.684 0.057 -0.989zm-9.755 0.08c-0.235 0.158 -0.465 0.324 -0.699 0.484l0.488 0.689c0.226 -0.164 0.454 -0.319 0.684 -0.477zm-1.388 0.989c-0.235 0.169 -0.477 0.356 -0.68 0.511l0.511 0.67c0.258 -0.188 0.436 -0.328 0.67 -0.501zm9.985 0.375c-0.141 0.215 -0.304 0.431 -0.468 0.596l0.614 0.586c0.202 -0.239 0.418 -0.484 0.566 -0.727zm-11.335 0.66c-0.229 0.178 -0.46 0.361 -0.66 0.53l0.535 0.652c0.22 -0.182 0.445 -0.371 0.652 -0.52zM18.802 8.109c-0.215 0.173 -0.441 0.342 -0.647 0.484l0.484 0.693c0.249 -0.169 0.492 -0.351 0.704 -0.52zm-11.597 0.604c-0.22 0.178 -0.431 0.365 -0.647 0.548l0.548 0.642c0.211 -0.182 0.422 -0.365 0.637 -0.543zm10.26 0.328c-0.239 0.141 -0.488 0.285 -0.712 0.408l0.403 0.746c0.253 -0.155 0.54 -0.292 0.75 -0.431zm-11.55 0.779c-0.211 0.188 -0.418 0.375 -0.628 0.566l0.566 0.628c0.206 -0.188 0.418 -0.375 0.623 -0.563zm10.101 0.019c-0.249 0.123 -0.496 0.249 -0.746 0.371l0.361 0.758c0.292 -0.141 0.507 -0.258 0.769 -0.38zm-1.5 0.723c-0.258 0.117 -0.507 0.229 -0.769 0.338l0.342 0.773c0.258 -0.112 0.516 -0.229 0.773 -0.348zM4.668 10.969c-0.239 0.211 -0.405 0.375 -0.623 0.586l0.596 0.61c0.22 -0.211 0.398 -0.394 0.604 -0.572zm8.311 0.272c-0.258 0.108 -0.516 0.22 -0.773 0.328l0.328 0.782c0.262 -0.108 0.52 -0.22 0.779 -0.333zm-1.551 0.657c-0.258 0.112 -0.516 0.226 -0.779 0.328l0.328 0.782c0.258 -0.108 0.52 -0.22 0.779 -0.328zm8.662 0.338c-1.5 0 -3 1.125 -3 3.375l3 6 3 -6c0 -2.25 -1.5 -3.375 -3 -3.375zm-10.219 0.319c-0.267 0.123 -0.548 0.235 -0.779 0.333l0.333 0.779c0.276 -0.117 0.54 -0.229 0.773 -0.333zM8.316 13.219c-0.253 0.117 -0.548 0.249 -0.773 0.351l0.348 0.769c0.276 -0.123 0.52 -0.244 0.764 -0.348zm-1.548 0.704c-0.262 0.127 -0.535 0.258 -0.769 0.375l0.38 0.755c0.253 -0.132 0.516 -0.253 0.746 -0.365zm13.322 0.188c0.829 0 1.5 0.67 1.5 1.5s-0.67 1.5 -1.5 1.5 -1.5 -0.67 -1.5 -1.5 0.67 -1.5 1.5 -1.5zm-14.85 0.577c-0.249 0.135 -0.496 0.276 -0.75 0.422l0.422 0.732c0.239 -0.141 0.484 -0.272 0.727 -0.403zM3.755 15.563c-0.263 0.15 -0.516 0.351 -0.735 0.496L3.53 16.735c0.233 -0.169 0.484 -0.342 0.684 -0.465zm-1.402 1.06c-0.226 0.206 -0.446 0.445 -0.619 0.647l0.642 0.548c0.18 -0.22 0.338 -0.384 0.548 -0.572zm10.21 0.06l0.076 0.839c0.244 -0.042 0.488 -0.014 0.732 0.023l0.146 -0.829c-0.308 -0.047 -0.637 -0.08 -0.951 -0.033zm-1.743 0.468l0.319 0.782c0.244 -0.108 0.496 -0.192 0.755 -0.272 -0.089 -0.267 -0.155 -0.54 -0.226 -0.811 -0.296 0.084 -0.59 0.197 -0.849 0.3zm3.634 -0.042l-0.477 0.693c0.197 0.146 0.389 0.3 0.543 0.492l0.637 -0.554c-0.239 -0.244 -0.422 -0.473 -0.704 -0.633zm-4.429 0.422c-0.258 0.132 -0.507 0.281 -0.755 0.427l0.427 0.727c0.244 -0.132 0.484 -0.285 0.723 -0.412zM1.22 18.047c-0.141 0.304 -0.256 0.633 -0.309 0.924l0.829 0.146c0.052 -0.267 0.124 -0.46 0.229 -0.689 -0.257 -0.112 -0.503 -0.249 -0.749 -0.38zm7.317 0.365c-0.239 0.155 -0.473 0.308 -0.708 0.468l0.468 0.704c0.235 -0.155 0.465 -0.315 0.699 -0.468zm7.158 0.057l-0.708 0.46c0.15 0.226 0.296 0.46 0.431 0.699l0.732 -0.422c-0.164 -0.262 -0.281 -0.496 -0.454 -0.735zm-8.564 0.891c-0.235 0.155 -0.468 0.304 -0.699 0.468l0.468 0.704c0.226 -0.164 0.465 -0.319 0.704 -0.477zm-5.381 0.445c-0.272 0.057 -0.545 0.104 -0.819 0.155 0.05 0.328 0.18 0.647 0.3 0.9l0.762 -0.365c-0.102 -0.235 -0.198 -0.477 -0.244 -0.689zm14.818 0.132l-0.732 0.422c0.146 0.253 0.315 0.524 0.45 0.741l0.708 -0.454c-0.158 -0.249 -0.296 -0.484 -0.427 -0.708zm-10.828 0.351c-0.235 0.146 -0.465 0.285 -0.708 0.422l0.418 0.735c0.249 -0.146 0.496 -0.292 0.735 -0.445zm-3.342 0.764l-0.577 0.619c0.26 0.249 0.582 0.412 0.933 0.488l0.188 -0.82c-0.208 -0.042 -0.403 -0.146 -0.543 -0.285zm1.923 0.014c-0.235 0.108 -0.478 0.192 -0.732 0.244l0.192 0.826c0.3 -0.06 0.585 -0.173 0.867 -0.292zm13.14 0.226l-0.652 0.53c0.202 0.249 0.45 0.488 0.665 0.657l0.52 -0.665c-0.206 -0.158 -0.384 -0.351 -0.535 -0.52zm1.13 0.82l-0.211 0.82c0.371 0.076 0.647 0.099 0.994 0.06l-0.104 -0.839c-0.229 0.037 -0.454 0.014 -0.68 -0.042z"
          />
        </svg>
        <span class="metric"> {{ this.totalDistance() }} km</span>
      </div>

      <div style="margin-left: auto; margin-right: 0; padding-top: 0.4em">
        <div style="display: inline-block">
          <input
            id="multiple_gpx_input"
            style="display: none"
            type="file"
            multiple
            accept=".gpx"
            v-on:change="uploadMultipleGPXs($event)"
          />
          <label
            href="#"
            class="text-decoration-none ms-auto black"
            title="Upload multiple GPXs"
            for="multiple_gpx_input"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              fill="currentColor"
              class="bi bi-upload"
              viewBox="0 0 16 15"
            >
              <path
                d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5z"
              />
              <path
                d="M7.646 1.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1-.708.708L8.5 2.707V11.5a.5.5 0 0 1-1 0V2.707L5.354 4.854a.5.5 0 1 1-.708-.708l3-3z"
              />
            </svg>
          </label>
        </div>
        <a
          href="#"
          class="text-decoration-none ms-auto black"
          style="padding-top: 0.4em; padding-left: 0.3em"
          @click="addDay"
          title="Add a day to the tour"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            fill="currentColor"
            class="bi bi-plus-square"
            viewBox="0 0 16 16"
          >
            <path
              d="M14 1a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1h12zM2 0a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V2a2 2 0 0 0-2-2H2z"
            />
            <path
              d="M8 4a.5.5 0 0 1 .5.5v3h3a.5.5 0 0 1 0 1h-3v3a.5.5 0 0 1-1 0v-3h-3a.5.5 0 0 1 0-1h3v-3A.5.5 0 0 1 8 4z"
            />
          </svg>
        </a>
      </div>
    </div>
    <ul class="list-unstyled ps-0" :key="day.id" v-for="(day, index) in days">
      <li class="mb-1">
        <button
          class="btn btn-toggle align-items-center rounded"
          data-bs-toggle="collapse"
          v-bind:data-bs-target="toStr('#day', day.id)"
          aria-expanded="true"
        ></button>

        <input
          v-if="day.edit"
          v-model="day.title"
          @blur="
            day.edit = false;
            $emit('update');
          "
          @keyup.enter="
            day.edit = false;
            $emit('update');
          "
          v-focus
        />
        <span v-else @click="day.edit = true" class="day-title">
          {{ day.title }}
        </span>

        <a
          href="#"
          class="text-decoration-none float-end route-button"
          style="padding: 2px"
          title="Remove"
          @click="removeDay(index)"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            fill="red"
            class="bi bi-trash"
            viewBox="0 0 15 15"
          >
            <path
              d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"
            />
            <path
              fill-rule="evenodd"
              d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"
            />
          </svg>
        </a>

        <a
          href="#"
          class="text-decoration-none float-end route-button"
          style="padding: 2px"
          title="Move view"
          @click="onHighlight(day)"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            fill="currentColor"
            class="bi bi-compass"
            viewBox="0 0 16 16"
          >
            <path
              d="M8 16.016a7.5 7.5 0 0 0 1.962-14.74A1 1 0 0 0 9 0H7a1 1 0 0 0-.962 1.276A7.5 7.5 0 0 0 8 16.016zm6.5-7.5a6.5 6.5 0 1 1-13 0 6.5 6.5 0 0 1 13 0z"
            />
            <path d="m6.94 7.44 4.95-2.83-2.83 4.95-4.949 2.83 2.828-4.95z" />
          </svg>
        </a>

        <div style="margin-left: 0.5em" class="small">
          <svg
            class="metric-icon"
            width="24px"
            height="24px"
            viewBox="0 0 36 36"
            id="template"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M30.311 28.112 20.234 9.85c-0.005 -0.009 -0.013 -0.014 -0.019 -0.023a0.3 0.3 0 0 0 -0.043 -0.051 0.372 0.372 0 0 0 -0.057 -0.048c-0.007 0 -0.012 -0.013 -0.02 -0.017a0.292 0.292 0 0 0 -0.036 -0.011 0.337 0.337 0 0 0 -0.068 -0.022 0.371 0.371 0 0 0 -0.067 -0.006 0.388 0.388 0 0 0 -0.067 0.006 0.4 0.4 0 0 0 -0.067 0.021 0.265 0.265 0 0 0 -0.037 0.012c-0.008 0 -0.013 0.013 -0.021 0.018a0.305 0.305 0 0 0 -0.055 0.046 0.365 0.365 0 0 0 -0.045 0.052c-0.005 0.009 -0.014 0.014 -0.019 0.023L13.807 20.374l-1.773 -3.212a0.2 0.2 0 0 0 -0.019 -0.022 0.357 0.357 0 0 0 -0.044 -0.052 0.31 0.31 0 0 0 -0.056 -0.047c-0.008 0 -0.012 -0.013 -0.02 -0.018s-0.025 -0.006 -0.037 -0.011a0.4 0.4 0 0 0 -0.067 -0.022 0.378 0.378 0 0 0 -0.067 0 0.371 0.371 0 0 0 -0.067 0 0.375 0.375 0 0 0 -0.067 0.022c-0.012 0 -0.026 0 -0.037 0.011s-0.013 0.013 -0.021 0.018a0.31 0.31 0 0 0 -0.056 0.047 0.432 0.432 0 0 0 -0.044 0.052c-0.005 0.008 -0.014 0.013 -0.019 0.022L7.805 23.7 6.454 21.255c0 -0.009 -0.013 -0.014 -0.019 -0.023a0.518 0.518 0 0 0 -0.044 -0.051 0.31 0.31 0 0 0 -0.056 -0.047c-0.008 0 -0.012 -0.013 -0.021 -0.018s-0.024 -0.006 -0.036 -0.011a0.309 0.309 0 0 0 -0.067 -0.022 0.379 0.379 0 0 0 -0.067 -0.006 0.321 0.321 0 0 0 -0.134 0.027c-0.012 0.005 -0.026 0.006 -0.037 0.012a0.2 0.2 0 0 0 -0.021 0.018 0.31 0.31 0 0 0 -0.056 0.047 0.358 0.358 0 0 0 -0.044 0.051c0 0.009 -0.014 0.014 -0.019 0.023L2.05 28.112a0.355 0.355 0 0 0 0.139 0.481 0.342 0.342 0 0 0 0.171 0.045 0.357 0.357 0 0 0 0.311 -0.183L6.144 22.16l1.35 2.448c0 0.007 0.012 0.01 0.016 0.016a0.337 0.337 0 0 0 0.1 0.1c0.007 0 0.012 0.012 0.019 0.016l0 0a0.354 0.354 0 0 0 0.342 0l0 0c0.008 0 0.012 -0.011 0.02 -0.016a0.345 0.345 0 0 0 0.1 -0.1c0 -0.006 0.012 -0.009 0.016 -0.016l3.609 -6.54 1.649 2.988c0.009 0.016 0.026 0.023 0.037 0.037L11.083 25.31a0.355 0.355 0 0 0 0.14 0.482 0.346 0.346 0 0 0 0.171 0.044 0.352 0.352 0 0 0 0.31 -0.183l8.22 -14.9 9.765 17.7a0.357 0.357 0 0 0 0.311 0.183 0.339 0.339 0 0 0 0.171 -0.045A0.355 0.355 0 0 0 30.311 28.112Z"
            />
          </svg>
          <span class="metric"> {{ day.elevation }} m</span>

          <svg
            style="margin-left: 0.6em"
            class="metric-icon"
            width="24px"
            height="24px"
            viewBox="0 0 32 20"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              fill="#000"
              d="M4.34 0.985c-1.5 0 -3.003 1.125 -3.003 3.375L4.34 10.359l3 -6c0 -2.25 -1.5 -3.375 -3 -3.375zm13.233 1.828c-0.324 0.013 -0.637 0.076 -0.9 0.132l0.178 0.826c0.262 -0.059 0.535 -0.096 0.764 -0.112zM4.34 2.86c0.829 0 1.5 0.672 1.5 1.5 0 0.829 -0.67 1.5 -1.5 1.5 -0.828 0 -1.5 -0.67 -1.5 -1.5 0 -0.828 0.672 -1.5 1.5 -1.5zm14.165 0.01l-0.141 0.829c0.229 0.048 0.46 0.108 0.66 0.229l0.408 -0.741c-0.285 -0.153 -0.604 -0.29 -0.928 -0.319zm-2.696 0.315c-0.285 0.111 -0.572 0.212 -0.815 0.308L15.328 4.266c0.258 -0.109 0.53 -0.205 0.758 -0.285zM20.204 3.811L19.561 4.359c0.169 0.194 0.3 0.431 0.403 0.623l0.755 -0.38c-0.158 -0.307 -0.3 -0.54 -0.516 -0.792zm-5.99 0.042c-0.285 0.146 -0.52 0.276 -0.773 0.403l0.412 0.741c0.244 -0.141 0.511 -0.276 0.727 -0.384zm-1.515 0.839c-0.249 0.146 -0.492 0.292 -0.732 0.45l0.46 0.704c0.229 -0.15 0.468 -0.292 0.704 -0.431zM21.01 5.532c-0.276 0.047 -0.558 0.08 -0.835 0.112 0.019 0.235 0.004 0.488 -0.042 0.684l0.82 0.192c0.047 -0.338 0.089 -0.684 0.057 -0.989zm-9.755 0.08c-0.235 0.158 -0.465 0.324 -0.699 0.484l0.488 0.689c0.226 -0.164 0.454 -0.319 0.684 -0.477zm-1.388 0.989c-0.235 0.169 -0.477 0.356 -0.68 0.511l0.511 0.67c0.258 -0.188 0.436 -0.328 0.67 -0.501zm9.985 0.375c-0.141 0.215 -0.304 0.431 -0.468 0.596l0.614 0.586c0.202 -0.239 0.418 -0.484 0.566 -0.727zm-11.335 0.66c-0.229 0.178 -0.46 0.361 -0.66 0.53l0.535 0.652c0.22 -0.182 0.445 -0.371 0.652 -0.52zM18.802 8.109c-0.215 0.173 -0.441 0.342 -0.647 0.484l0.484 0.693c0.249 -0.169 0.492 -0.351 0.704 -0.52zm-11.597 0.604c-0.22 0.178 -0.431 0.365 -0.647 0.548l0.548 0.642c0.211 -0.182 0.422 -0.365 0.637 -0.543zm10.26 0.328c-0.239 0.141 -0.488 0.285 -0.712 0.408l0.403 0.746c0.253 -0.155 0.54 -0.292 0.75 -0.431zm-11.55 0.779c-0.211 0.188 -0.418 0.375 -0.628 0.566l0.566 0.628c0.206 -0.188 0.418 -0.375 0.623 -0.563zm10.101 0.019c-0.249 0.123 -0.496 0.249 -0.746 0.371l0.361 0.758c0.292 -0.141 0.507 -0.258 0.769 -0.38zm-1.5 0.723c-0.258 0.117 -0.507 0.229 -0.769 0.338l0.342 0.773c0.258 -0.112 0.516 -0.229 0.773 -0.348zM4.668 10.969c-0.239 0.211 -0.405 0.375 -0.623 0.586l0.596 0.61c0.22 -0.211 0.398 -0.394 0.604 -0.572zm8.311 0.272c-0.258 0.108 -0.516 0.22 -0.773 0.328l0.328 0.782c0.262 -0.108 0.52 -0.22 0.779 -0.333zm-1.551 0.657c-0.258 0.112 -0.516 0.226 -0.779 0.328l0.328 0.782c0.258 -0.108 0.52 -0.22 0.779 -0.328zm8.662 0.338c-1.5 0 -3 1.125 -3 3.375l3 6 3 -6c0 -2.25 -1.5 -3.375 -3 -3.375zm-10.219 0.319c-0.267 0.123 -0.548 0.235 -0.779 0.333l0.333 0.779c0.276 -0.117 0.54 -0.229 0.773 -0.333zM8.316 13.219c-0.253 0.117 -0.548 0.249 -0.773 0.351l0.348 0.769c0.276 -0.123 0.52 -0.244 0.764 -0.348zm-1.548 0.704c-0.262 0.127 -0.535 0.258 -0.769 0.375l0.38 0.755c0.253 -0.132 0.516 -0.253 0.746 -0.365zm13.322 0.188c0.829 0 1.5 0.67 1.5 1.5s-0.67 1.5 -1.5 1.5 -1.5 -0.67 -1.5 -1.5 0.67 -1.5 1.5 -1.5zm-14.85 0.577c-0.249 0.135 -0.496 0.276 -0.75 0.422l0.422 0.732c0.239 -0.141 0.484 -0.272 0.727 -0.403zM3.755 15.563c-0.263 0.15 -0.516 0.351 -0.735 0.496L3.53 16.735c0.233 -0.169 0.484 -0.342 0.684 -0.465zm-1.402 1.06c-0.226 0.206 -0.446 0.445 -0.619 0.647l0.642 0.548c0.18 -0.22 0.338 -0.384 0.548 -0.572zm10.21 0.06l0.076 0.839c0.244 -0.042 0.488 -0.014 0.732 0.023l0.146 -0.829c-0.308 -0.047 -0.637 -0.08 -0.951 -0.033zm-1.743 0.468l0.319 0.782c0.244 -0.108 0.496 -0.192 0.755 -0.272 -0.089 -0.267 -0.155 -0.54 -0.226 -0.811 -0.296 0.084 -0.59 0.197 -0.849 0.3zm3.634 -0.042l-0.477 0.693c0.197 0.146 0.389 0.3 0.543 0.492l0.637 -0.554c-0.239 -0.244 -0.422 -0.473 -0.704 -0.633zm-4.429 0.422c-0.258 0.132 -0.507 0.281 -0.755 0.427l0.427 0.727c0.244 -0.132 0.484 -0.285 0.723 -0.412zM1.22 18.047c-0.141 0.304 -0.256 0.633 -0.309 0.924l0.829 0.146c0.052 -0.267 0.124 -0.46 0.229 -0.689 -0.257 -0.112 -0.503 -0.249 -0.749 -0.38zm7.317 0.365c-0.239 0.155 -0.473 0.308 -0.708 0.468l0.468 0.704c0.235 -0.155 0.465 -0.315 0.699 -0.468zm7.158 0.057l-0.708 0.46c0.15 0.226 0.296 0.46 0.431 0.699l0.732 -0.422c-0.164 -0.262 -0.281 -0.496 -0.454 -0.735zm-8.564 0.891c-0.235 0.155 -0.468 0.304 -0.699 0.468l0.468 0.704c0.226 -0.164 0.465 -0.319 0.704 -0.477zm-5.381 0.445c-0.272 0.057 -0.545 0.104 -0.819 0.155 0.05 0.328 0.18 0.647 0.3 0.9l0.762 -0.365c-0.102 -0.235 -0.198 -0.477 -0.244 -0.689zm14.818 0.132l-0.732 0.422c0.146 0.253 0.315 0.524 0.45 0.741l0.708 -0.454c-0.158 -0.249 -0.296 -0.484 -0.427 -0.708zm-10.828 0.351c-0.235 0.146 -0.465 0.285 -0.708 0.422l0.418 0.735c0.249 -0.146 0.496 -0.292 0.735 -0.445zm-3.342 0.764l-0.577 0.619c0.26 0.249 0.582 0.412 0.933 0.488l0.188 -0.82c-0.208 -0.042 -0.403 -0.146 -0.543 -0.285zm1.923 0.014c-0.235 0.108 -0.478 0.192 -0.732 0.244l0.192 0.826c0.3 -0.06 0.585 -0.173 0.867 -0.292zm13.14 0.226l-0.652 0.53c0.202 0.249 0.45 0.488 0.665 0.657l0.52 -0.665c-0.206 -0.158 -0.384 -0.351 -0.535 -0.52zm1.13 0.82l-0.211 0.82c0.371 0.076 0.647 0.099 0.994 0.06l-0.104 -0.839c-0.229 0.037 -0.454 0.014 -0.68 -0.042z"
            />
          </svg>
          <span class="metric"> {{ day.distance }} km</span>
        </div>

        <div class="collapse show ms-auto" v-bind:id="toStr('day', day.id)">
          <ul
            class="btn-toggle-nav list-unstyled fw-normal pb-1 small"
            style="padding: 0.25rem 0.5rem"
          >
            <li>
              <div class="form-check form-switch">
                <input
                  class="form-check-input"
                  type="checkbox"
                  v-bind:id="toStr('flexSwitchCheckChecked', day.id)"
                  v-model="day.showOnMap"
                  @change="onShowRouteOnMap(day)"
                  checked
                />
                <label
                  class="form-check-label"
                  v-bind:for="toStr('flexSwitchCheckChecked', day.id)"
                  >Show on map</label
                >
              </div>
              <div class="input-group input-group-sm mb-3">
                <span class="input-group-text" id="inputGroup-sizing-sm"
                  >URL</span
                >
                <input
                  type="text"
                  class="form-control"
                  v-model="day.gpx_url"
                  v-on:input="onUpdateGPXURL(day)"
                  aria-label="url input"
                  aria-describedby="inputGroup-sizing-sm"
                />
                <a
                  href="#"
                  class="
                    text-decoration-none
                    float-end
                    route-button
                    metric-icon
                  "
                  v-on:click="onUpdateGPXURL(day)"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="20"
                    height="20"
                    fill="currentColor"
                    class="bi bi-arrow-clockwise"
                    viewBox="0 0 16 16"
                  >
                    <path
                      fill-rule="evenodd"
                      d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 0 1 .908-.417A6 6 0 1 1 8 2v1z"
                    />
                    <path
                      d="M8 4.466V.534a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 0 1 8 4.466z"
                    />
                  </svg>
                </a>
              </div>
              <div class="small" style="margin: -1em 0em 0.3em 0.1em">or</div>

              <div class="input-group input-group-sm mb-3 custom-file-button">
                <label
                  class="input-group-text"
                  v-bind:for="toStr('inputGroupFile', day.id)"
                  >Upload GPX</label
                >
                <input
                  type="file"
                  class="form-control"
                  style="display: none"
                  v-bind:id="toStr('inputGroupFile', day.id)"
                  accept=".gpx"
                  v-on:change="selectedGPXFile($event, day)"
                />
                <span
                  class="day-title"
                  style="display: inline-block; margin: auto auto auto 3px"
                  v-bind:title="day.gpx_file_name"
                >
                  {{ day.gpx_file_name }}
                </span>
              </div>

              <table
                class="table table-sm table-borderless"
                v-if="day.hasPoints()"
                style="width: 65%; margin-bottom: 0"
              >
                <tbody>
                  <tr>
                    <td class="text-end"><span class="small">flat</span></td>
                    <td>
                      <span class="metric-sec"
                        >{{ day.getDistanceOnFlat() }} km</span
                      >
                    </td>
                    <td class="text-end"><span class="small">descent</span></td>
                    <td>
                      <span class="metric-sec"
                        >{{ day.getDistanceOnDescent() }} km</span
                      >
                    </td>
                  </tr>
                  <tr>
                    <td class="text-end"><span class="small">medium</span></td>
                    <td>
                      <span class="metric-sec"
                        >{{ day.getDistanceOnMedHills() }} km</span
                      >
                    </td>
                    <td class="text-end"><span class="small">hard</span></td>
                    <td>
                      <span class="metric-sec"
                        >{{ day.getDistanceOnHighHills() }} km</span
                      >
                    </td>
                  </tr>
                </tbody>
              </table>

              <apexchart
                v-if="day.hasPoints()"
                width="100%"
                height="150px"
                type="line"
                :options="day.chartOptions"
                :series="day.elevationPoints"
              ></apexchart>
            </li>
          </ul>
        </div>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.metric {
  vertical-align: sub;
  font-weight: 500;
}

.metric-sec {
  font-weight: 500;
  margin-left: 0.3em;
}

.metric-icon {
  margin-left: 0.1em;
}

.route-button:hover {
  color: rgb(126, 126, 126);
}

.route-button {
  color: black;
  padding: 2px 0px 0px 2px;
  margin: auto;
  background-color: transparent !important;
}

.black {
  color: black;
}

.black:hover {
  color: rgb(126, 126, 126);
}

.list-unstyled:hover {
  background-color: rgb(248, 248, 248);
}

.list-unstyled {
  background-color: rgb(250, 250, 250);
}

.day-title {
  max-width: 408px;
  display: inline-block;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  vertical-align: text-top;
}
.custom-file-button input[type="file"] {
  margin-left: -2px !important;
}

.custom-file-button input[type="file"]::-webkit-file-upload-button {
  display: none;
}

.custom-file-button input[type="file"]::file-selector-button {
  display: none;
}

.custom-file-button:hover label {
  background-color: #dde0e3;
  cursor: pointer;
}

.table-sm > :not(caption) > * > * {
  padding: 0rem;
}
</style>