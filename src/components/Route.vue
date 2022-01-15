<script>
import GPXProcessor from "../js/gpx.js";
import VueApexCharts from "vue3-apexcharts";
import draggable from "vuedraggable";
import FileSaver from "file-saver";

let gpx1 = new GPXProcessor();
let gpx2 = new GPXProcessor();
let overlapp = [];
let donec = 0;
function done() {
  donec++;
  if (donec == 2) {
    //overlapp = gpx2.getOverlapWithPoints(gpx1.points);
    //console.log(overlapp);
  }
}
fetch("https://api.komoot.de/v007/tours/612872640/coordinates") //"src/assets/16.5.json"
  .then((response) => response.json())
  .then((items) => {
    //gpx1.setPoints(items.items);
    done();
  });
fetch("https://api.komoot.de/v007/tours/631638895/coordinates")
  .then((response) => response.json())
  .then((items) => {
    //gpx2.setPoints(items.items);
    done();
  });

class DayRoute {
  constructor(context, id, index) {
    // Display
    this.id = id;
    this.isOpen = true;
    this.title = "Day " + index;
    this.titleWithoutPrefix = "";

    this.gpx_url = "";
    this.gpx_file_name = "";

    this.elevation = 0.0;
    this.distance = 0.0;
    this.showOnMap = true;

    this.edit = false;

    this.elevationPoints = [{}];
    this.hasPoints = false;
    this.loaded = true;

    // Private
    this._gpxProcessor = new GPXProcessor();
    this._index = index;
    this._context = context;

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
        },
      },
      chart: {
        width: "100%",
        animations: {
          enabled: false,
        },
        offsetY: 0,
        parentHeightOffset: -20,
        events: {
          model: this,
          mouseLeave: function (event, chartContext, config) {
            this.model._context.onMovePinAtDistanceFromStart(
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

  onOpen() {
    this.elevationPoints[0].name='Altitude_';
  }

  setLatLongPoints(points) {
    this._gpxProcessor.setPoints(points);
    this.elevation = this._gpxProcessor.getElevation();
    this.distance = this._gpxProcessor.getDistance();

    this.elevationPoints = [
      {
        name: "Altitude",
        data: this._gpxProcessor.getElevationPoints(),
      },
    ];

    this.hasPoints = this._gpxProcessor.points.length > 0;
  }

  getPoints() {
    return this._gpxProcessor.points;
  }

  getElevationPoints() {
    return this.elevationPoints;
  }

  setIndex(index) {
    this._index = index;
    this.updateTitle();
  }

  updateTitle(title) {
    this.titleWithoutPrefix = title;
    this.updateTitle();
  }

  updateTitle() {
    this.title = "Day " + this._index;
    if (this.titleWithoutPrefix !== "")
      this.title += ": " + this.titleWithoutPrefix;
  }

  getCenterPoint() {
    return this._gpxProcessor.getCenterPoint();
  }
  getOverlapWithPoints(other_points) {
    return this._gpxProcessor.getOverlapWithPoints(other_points);
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
    draggable,
  },
  data() {
    return {
      nextDayId: 0,
      pendingDaysToLoad: 0,
      days: [],
      editedDay: null,
      // Route totals
      totalDistance: function () {
        let total = 0;
        this.days.forEach((day) => (total += day.distance));
        return total;
      },
      totalElevation: function () {
        let total = 0;
        this.days.forEach((day) => (total += day.elevation));
        return total;
      },
      nonEmptyDaysCount: function () {
        return this.days.filter((day) => day.distance > 0).length;
      },
    };
  },
  methods: {
    toStr: function (str, index) {
      return str + "-" + index;
    },
    addDay: function () {
      this.days.push(
        new DayRoute(this, ++this.nextDayId, this.days.length + 1)
      );
    },
    removeDay: function (index) {
      this.triggerOverlapCalculations();
      let id = this.days[index].id;
      this.days.splice(index, 1);

      this.$emit("onDeleteDay", { id: id });

      this.days.forEach((d, index) => {
        d.setIndex(index + 1);
      });
    },
    removeAllDays: function () {
      for (let index = this.days.length - 1; index >= 0; index--) {
        this.removeDay(index);
      }
    },
    editDay: function (day) {
      this.editedDay = day;
    },
    saveDay: function () {
      if (!this.days.length) return;

      let daysToSave = [];
      this.days.forEach((day) => {
        daysToSave.push({
          title: day.title,
          gpx_url: day.gpx_url,
          gpx_file_name: day.gpx_file_name,
          showOnMap: day.showOnMap,
        });
      });

      var blob = new Blob([JSON.stringify(daysToSave)], {
        type: "text/plain;charset=utf-8",
      });

      let timestamp = new Date()
        .toISOString()
        .slice(0, 16)
        .replace(/[:]/g, "-");
      FileSaver.saveAs(blob, "TourSummary-" + timestamp + ".mkr");
    },

    // GPX Manipulation
    updateRouteFromGpxFile: function (day, file, onLoadEndCallback) {
      if (!file) {
        this.updateRoutePoints(day, []);
        return;
      }

      let points = [];
      const reader = new FileReader();

      reader.onload = (e) => {
        const parser = new DOMParser();
        const doc = parser.parseFromString(e.target.result, "application/xml");

        doc.getElementsByTagName("trkpt").forEach((gpx_point) => {
          points.push({
            lat: parseFloat(gpx_point.getAttribute("lat")),
            lng: parseFloat(gpx_point.getAttribute("lon")),
            alt: parseFloat(
              gpx_point.getElementsByTagName("ele")[0].textContent
            ),
          });
        });
      };

      reader.addEventListener("loadend", (e) => {
        day.gpx_file_name = file.name;
        day.updateTitle(day.gpx_file_name.replace(/\.[^/.]+$/, ""));

        this.pendingDaysToLoad--;
        this.updateRoutePoints(day, points);
        if (onLoadEndCallback) onLoadEndCallback(day);
      });

      reader.readAsText(file);
    },

    loadMultipleFiles: function (mkrDesc, event) {
      if (mkrDesc) {
        this.pendingDaysToLoad = mkrDesc.length;

        mkrDesc.forEach((dayDesc) => {
          this.addDay();
          let day = this.days[this.days.length - 1];
          day.title = dayDesc.title;
          day.gpx_url = dayDesc.gpx_url;
          day.gpx_file_name = dayDesc.gpx_file_name;
          day.showOnMap = dayDesc.showOnMap;

          if (day.gpx_url) {
            this.loadPointsFromURL(day);
          } else if (day.gpx_file_name) {
            let gpxFileHandle = event.target.files.find((file) => {
              file.name == day.gpx_file_name;
            });

            day.loaded = gpxFileHandle != undefined;
            this.updateRouteFromGpxFile(day, gpxFileHandle, (day) => {
              if (day._index == 1) this.onSetRouteInCenterView(day);
              day.isOpen = day._index == 1;
            });
          }
        });
      } else {
        this.pendingDaysToLoad = event.target.files.length;

        for (let index = 0; index < event.target.files.length; index++) {
          const file = event.target.files[index];

          this.addDay();
          let day = this.days[this.days.length - 1];
          this.updateRouteFromGpxFile(day, file, (day) => {
            if (day._index == 1) this.onSetRouteInCenterView(day);
            day.isOpen = day._index == 1;
          });
        }
      }
    },

    onUploadMultipleGPXs: function (event) {
      if (event.target.files.length > 0) this.removeAllDays();

      let mkrFile = Array.from(event.target.files).find((file) =>
        file.name.endsWith(".mkr")
      );
      if (mkrFile) {
        const reader = new FileReader();
        reader.onload = (e) => {
          this.loadMultipleFiles(JSON.parse(e.target.result), event);
        };
        reader.readAsText(file);
      } else {
        this.loadMultipleFiles(undefined, event);
      }
    },

    // Events
    onTitleUpdated: function (day) {
      day.updateTitle();
    },

    onSelectedGPXFile: function (event, day) {
      const file = event.target.files[0];
      this.pendingDaysToLoad = 1;
      this.updateRouteFromGpxFile(day, file, (day) => {
        this.onSetRouteInCenterView(day);
      });
    },

    findDayOverlaps(triggerDay, day_index) {
      if (day_index == 0) return;

      this.days.forEach((day, index) => {
        if (triggerDay && day.id == triggerDay.id) return;
        if (index > day_index) return;

        let overlappingChains = triggerDay.getOverlapWithPoints(
          day.getPoints()
        );

        if (overlappingChains.length > 0) {
          this.$emit("onUpdateRouteOverlaps", {
            id: triggerDay.id,
            points: overlappingChains,
          });
        }
      });
    },

    async triggerOverlapCalculations() {
      if (this.days.length <= 1) return;

      this.days.forEach((day, index) => {
        this.findDayOverlaps(day, index);
      });
    },

    updateRoutePoints: function (day, points) {
      day.setLatLongPoints(points);

      this.$emit("onUpdateRoutePoints", { id: day.id, points: points });

      if (!day.showOnMap || !day.hasPoints) {
        this.$emit("onShowRouteOnMap", { id: day.id, show: day.showOnMap });
      }

      if (this.pendingDaysToLoad <= 0) this.triggerOverlapCalculations();
    },

    loadPointsFromURL: function (day, onLoadEndCallback) {
      if (!day.gpx_url) return;

      let tourId = day.gpx_url.split("/").pop();
      let kommotUrl = `https://api.komoot.de/v007/tours/${tourId}/coordinates`;

      //"src/assets/gpx.json"
      fetch(kommotUrl)
        .then((response) => response.json())
        .then((items) => {
          this.updateRoutePoints(day, items.items);
          if (onLoadEndCallback) onLoadEndCallback(day);
        })
        .catch((error) => {
          alert("Cannot load: " + error);
        })
        .finally(() => {
          this.pendingDaysToLoad--;
        });
    },

    updateRouteFromURL: function (day) {
      this.pendingDaysToLoad = 1;
      this.loadPointsFromURL(day, (day) => {
        this.onSetRouteInCenterView(day);
      });
    },
    onSetRouteInCenterView: function (day) {
      if (!day.showOnMap || !day.hasPoints) return;
      this.$emit("onSetRouteInCenterView", { point: day.getCenterPoint() });
    },
    onShowRouteOnMap: function (day) {
      day.showOnMap = !day.showOnMap;
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
    onHighlightRoute: function (day, state) {
      this.$emit("onHighlightRoute", { id: day.id, state: state });
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
    style="position: absolute; resize: both; overflow: auto; max-height: 100%"
  >
    <div id="routeListContainer" class="d-flex align-items-center link-dark">
      <div style="margin-left: 0.3em; margin-right: 0.5em; cursor: move">
        <span id="routeListTitle" style="cursor: move" class="fs-4 fw-semibold"
          >Tour Planner</span
        >
      </div>

      <div style="margin-left: auto; margin-right: 0">
        <a
          href="#"
          class="text-decoration-none ms-auto black"
          style="padding-top: 0.4em; padding-left: 1em"
          @click="saveDay"
          title="Download the tour as a .mkr project file"
          ><span class="xsmall align-sub">download </span>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            fill="currentColor"
            class="bi bi-save"
            viewBox="0 0 16 16"
          >
            <path
              d="M2 1a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1H9.5a1 1 0 0 0-1 1v7.293l2.646-2.647a.5.5 0 0 1 .708.708l-3.5 3.5a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L7.5 9.293V2a2 2 0 0 1 2-2H14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V2a2 2 0 0 1 2-2h2.5a.5.5 0 0 1 0 1H2z"
            />
          </svg>
        </a>

        <div style="display: inline-block; padding-left: 0.6em">
          <input
            id="multiple_gpx_input"
            style="display: none"
            type="file"
            multiple
            accept=".gpx,.mkr"
            v-on:change="onUploadMultipleGPXs($event)"
          />
          <label
            href="#"
            class="text-decoration-none ms-auto black"
            title="Upload mutiple GPXs or a .mkr file alongside it's required .gpx files"
            for="multiple_gpx_input"
            ><span class="xsmall align-sub" style="cursor: pointer"
              >upload
            </span>
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
          style="padding-top: 0.4em; padding-left: 0.6em"
          @click="addDay"
          title="Add a new day to the tour"
          ><span class="xsmall align-sub">add day </span>
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
    <div
      id="routeListTotals"
      class="mb-3 pb-3 border-bottom"
      style="cursor: move"
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
      <span
        class="metric xsmall"
        style="margin-left: 0.6em; font-weight: 400; font-style: italic"
      >
        {{
          this.nonEmptyDaysCount()
            ? Math.ceil(this.totalElevation() / this.nonEmptyDaysCount())
            : 0
        }}
        m/day</span
      >

      <svg
        style="margin-left: 1em"
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
      <span
        class="metric xsmall"
        style="margin-left: 0.6em; font-weight: 400; font-style: italic"
      >
        {{
          this.nonEmptyDaysCount()
            ? Math.ceil(this.totalDistance() / this.nonEmptyDaysCount())
            : 0
        }}
        km/day</span
      >
    </div>

    <draggable
      tag="ul"
      :list="days"
      class="ps-0"
      style="overflow: hidden; height: 100%"
      item-key="id"
      handle=".drag-handle"
      ghost-class="ghost"
      :disabled="!days.length"
    >
      <template #item="{ element, index }">
        <li
          class="list-group-item list-unstyled mb-1 drag-handle"
          style="
            padding: 0px;
            margin-bottom: 16px;
            border: 1px solid rgba(0, 0, 0, 0.125);
          "
          @mouseenter="onHighlightRoute(element, true)"
          @mouseleave="onHighlightRoute(element, false)"
          v-bind:class="{
            'not-draggable': !days.length,
            'list-unstyled-error': !element.loaded,
          }"
        >
          <button
            class="btn btn-toggle align-items-center rounded"
            v-bind:class="{ collapsed: !element.isOpen }"
            data-bs-toggle="collapse"
            v-bind:data-bs-target="toStr('#day', element.id)"
            v-bind:aria-expanded="element.isOpen"
            @click="element.onOpen()"
          ></button>

          <input
            v-if="element.edit"
            v-model="element.titleWithoutPrefix"
            @change="onTitleUpdated(element)"
            @blur="element.edit = false"
            @keyup.enter="element.edit = false"
            v-focus
          />
          <span v-else @click="element.edit = true" class="day-title">
            {{ element.title }}
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
            @click="onSetRouteInCenterView(element)"
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

          <a
            v-if="element.showOnMap"
            @click="onShowRouteOnMap(element)"
            style="padding-right: 4px"
            class="text-decoration-none float-end route-button"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="21"
              height="17"
              fill="currentColor"
              class="bi bi-eye"
              viewBox="0 0 14 14"
            >
              <path
                d="M16 8s-3-5.5-8-5.5S0 8 0 8s3 5.5 8 5.5S16 8 16 8zM1.173 8a13.133 13.133 0 0 1 1.66-2.043C4.12 4.668 5.88 3.5 8 3.5c2.12 0 3.879 1.168 5.168 2.457A13.133 13.133 0 0 1 14.828 8c-.058.087-.122.183-.195.288-.335.48-.83 1.12-1.465 1.755C11.879 11.332 10.119 12.5 8 12.5c-2.12 0-3.879-1.168-5.168-2.457A13.134 13.134 0 0 1 1.172 8z"
              />
              <path
                d="M8 5.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM4.5 8a3.5 3.5 0 1 1 7 0 3.5 3.5 0 0 1-7 0z"
              />
            </svg>
          </a>
          <a
            v-if="!element.showOnMap"
            @click="onShowRouteOnMap(element)"
            class="text-decoration-none float-end route-button"
            style="padding-right: 4px"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="21"
              height="17"
              fill="currentColor"
              class="bi bi-eye-slash"
              viewBox="0 0 14 14"
            >
              <path
                d="M13.359 11.238C15.06 9.72 16 8 16 8s-3-5.5-8-5.5a7.028 7.028 0 0 0-2.79.588l.77.771A5.944 5.944 0 0 1 8 3.5c2.12 0 3.879 1.168 5.168 2.457A13.134 13.134 0 0 1 14.828 8c-.058.087-.122.183-.195.288-.335.48-.83 1.12-1.465 1.755-.165.165-.337.328-.517.486l.708.709z"
              />
              <path
                d="M11.297 9.176a3.5 3.5 0 0 0-4.474-4.474l.823.823a2.5 2.5 0 0 1 2.829 2.829l.822.822zm-2.943 1.299.822.822a3.5 3.5 0 0 1-4.474-4.474l.823.823a2.5 2.5 0 0 0 2.829 2.829z"
              />
              <path
                d="M3.35 5.47c-.18.16-.353.322-.518.487A13.134 13.134 0 0 0 1.172 8l.195.288c.335.48.83 1.12 1.465 1.755C4.121 11.332 5.881 12.5 8 12.5c.716 0 1.39-.133 2.02-.36l.77.772A7.029 7.029 0 0 1 8 13.5C3 13.5 0 8 0 8s.939-1.721 2.641-3.238l.708.709zm10.296 8.884-12-12 .708-.708 12 12-.708.708z"
              />
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
            <span class="metric"> {{ element.elevation }} m</span>

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
            <span class="metric"> {{ element.distance }} km</span>
          </div>
          <div
            class="collapse ms-auto"
            v-bind:class="{ show: element.isOpen }"
            v-bind:id="toStr('day', element.id)"
          >
            <ul
              class="btn-toggle-nav list-unstyled fw-normal pb-1 small"
              style="padding: 0.25rem 0.5rem"
            >
              <li>
                <div class="input-group input-group-sm mb-3">
                  <span class="input-group-text" id="inputGroup-sizing-sm"
                    >URL</span
                  >
                  <input
                    type="text"
                    class="form-control"
                    v-model="element.gpx_url"
                    v-on:input="updateRouteFromURL(element)"
                    aria-label="url input"
                    aria-describedby="inputGroup-sizing-sm"
                  />
                  <a
                    class="
                      text-decoration-none
                      float-end
                      route-button
                      metric-icon
                    "
                    v-on:click="updateRouteFromURL(element)"
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
                    v-bind:for="toStr('inputGroupFile', element.id)"
                    >Upload GPX</label
                  >
                  <input
                    type="file"
                    class="form-control"
                    style="display: none"
                    v-bind:id="toStr('inputGroupFile', element.id)"
                    accept=".gpx"
                    v-on:change="onSelectedGPXFile($event, element)"
                  />
                  <span
                    class="day-title"
                    style="display: inline-block; margin: auto auto auto 3px"
                    v-bind:title="element.gpx_file_name"
                  >
                    {{ element.gpx_file_name }}
                  </span>
                </div>

                <table
                  class="table table-sm table-borderless"
                  v-if="element.hasPoints"
                  style="width: 65%; margin-bottom: 0"
                >
                  <tbody>
                    <tr>
                      <td class="text-end">
                        <span class="small">flat</span>
                      </td>
                      <td>
                        <span class="metric-sec"
                          >{{ element.getDistanceOnFlat() }} km</span
                        >
                      </td>
                      <td class="text-end">
                        <span class="small">descent</span>
                      </td>
                      <td>
                        <span class="metric-sec"
                          >{{ element.getDistanceOnDescent() }} km</span
                        >
                      </td>
                      <td>
                        <span class="metric-sec"
                          >{{
                            parseInt(
                              ((element.getDistanceOnDescent() +
                                element.getDistanceOnFlat()) /
                                element.distance) *
                                100
                            )
                          }}%</span
                        >
                      </td>
                    </tr>
                    <tr>
                      <td class="text-end">
                        <span class="small">medium</span>
                      </td>
                      <td>
                        <span class="metric-sec"
                          >{{ element.getDistanceOnMedHills() }} km</span
                        >
                      </td>
                      <td class="text-end">
                        <span class="small">hard</span>
                      </td>
                      <td>
                        <span class="metric-sec"
                          >{{ element.getDistanceOnHighHills() }} km</span
                        >
                      </td>
                      <td>
                        <span class="metric-sec"
                          >{{
                            parseInt(
                              100 -
                                Math.floor(
                                  ((element.getDistanceOnDescent() +
                                    element.getDistanceOnFlat()) /
                                    element.distance) *
                                    100
                                )
                            )
                          }}%</span
                        >
                      </td>
                    </tr>
                  </tbody>
                </table>

                <apexchart
                  v-if="element.hasPoints"
                  height="150px"
                  type="area"
                  :options="element.chartOptions"
                  :series="element.getElevationPoints()"
                ></apexchart>
              </li>
            </ul>
          </div>
        </li>
      </template>
    </draggable>
  </div>
</template>

<style scoped>
.metric {
  font-weight: 500;
}

.metric-sec {
  font-weight: 500;
  margin-left: 0.3em;
}

.metric-icon {
  margin-left: 0.2em;
  vertical-align: sub;
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

.xsmall {
  font-size: 0.8em;

  font-weight: 350;
}

.align-sub {
  vertical-align: sub;
}

.black {
  color: black;
}

.black:hover {
  color: rgb(126, 126, 126);
}

.list-unstyled {
  background-color: #f9fafb1f;
}

.list-unstyled-error {
  background-color: rgb(247, 133, 133);
}

.list-unstyled:hover {
  background-color: rgb(248, 248, 248);
}

.list-unstyled-error:hover {
  background-color: rgb(247, 110, 110);
}

.day-title {
  max-width: 408px;
  display: inline-block;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  vertical-align: text-top;
  font-weight: 650;
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

.buttons {
  margin-top: 35px;
}
.ghost {
  opacity: 0.5;
  background: #c8ebfb;
}
.not-draggable {
  cursor: no-drop;
}
</style>