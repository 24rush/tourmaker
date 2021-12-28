<script>
async function tryLoadGPX(url) {
  //let tourId = url.split("/").pop();
  //let kommotUrl = `https://api.komoot.de/v007/tours/${tourId}/coordinates`;

  return await fetch("src/assets/gpx.json").then((response) => response.json());
}

export default {
  data() {
    return {
      nextDayId: 0,
      days: [],
      editedDay: null,
    };
  },
  methods: {
    toStr: function (str, index) {
      return str + "-" + index;
    },
    addDay: function () {
      this.days.push({
        id: this.nextDayId++,
        gpx_url: "",
        showOnMap: true,
        edit: false,
        title: "Day " + (this.days.length + 1),
      });
    },
    removeDay: function (index) {
      let id = this.days[index].id;
      this.days.splice(index, 1);
      this.$emit("onDeleteDay", { id: id });
    },
    editDay: function (day) {
      this.editedDay = day;
    },

    // Events
    onUpdateGPXURL: function (day) {
      tryLoadGPX(day.gpx_url)
        .then((items) =>
          this.$emit("onUpdateRoutePoints", { id: day.id, points: items.items })
        )
        .catch((error) => {
          alert("Cannot load: " + day.gpx_url);
        });
    },
    onShowOnMap: function (day) {
      this.$emit("onShowOnMap", { id: day.id, show: day.showOnMap });
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
    var div = document.getElementById("routeList");

    var mousePosition;
    var offset = [0, 0];
    var isDown = false;

    div.addEventListener(
      "mousedown",
      function (e) {
        isDown = true;
        offset = [div.offsetLeft - e.clientX, div.offsetTop - e.clientY];
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
    id="routeList"
    class="flex-shrink-0 p-3 bg-white"
    style="width: 280px; position: absolute; cursor: pointer"
  >
    <div class="d-flex align-items-center pb-3 mb-3 link-dark border-bottom">
      <span class="fs-4 fw-semibold">Routes list</span>
      <a href="#" class="text-decoration-none ms-auto" @click="addDay">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          fill="currentColor"
          class="bi bi-plus-square-dotted"
          viewBox="0 0 16 16"
        >
          <path
            d="M2.5 0c-.166 0-.33.016-.487.048l.194.98A1.51 1.51 0 0 1 2.5 1h.458V0H2.5zm2.292 0h-.917v1h.917V0zm1.833 0h-.917v1h.917V0zm1.833 0h-.916v1h.916V0zm1.834 0h-.917v1h.917V0zm1.833 0h-.917v1h.917V0zM13.5 0h-.458v1h.458c.1 0 .199.01.293.029l.194-.981A2.51 2.51 0 0 0 13.5 0zm2.079 1.11a2.511 2.511 0 0 0-.69-.689l-.556.831c.164.11.305.251.415.415l.83-.556zM1.11.421a2.511 2.511 0 0 0-.689.69l.831.556c.11-.164.251-.305.415-.415L1.11.422zM16 2.5c0-.166-.016-.33-.048-.487l-.98.194c.018.094.028.192.028.293v.458h1V2.5zM.048 2.013A2.51 2.51 0 0 0 0 2.5v.458h1V2.5c0-.1.01-.199.029-.293l-.981-.194zM0 3.875v.917h1v-.917H0zm16 .917v-.917h-1v.917h1zM0 5.708v.917h1v-.917H0zm16 .917v-.917h-1v.917h1zM0 7.542v.916h1v-.916H0zm15 .916h1v-.916h-1v.916zM0 9.375v.917h1v-.917H0zm16 .917v-.917h-1v.917h1zm-16 .916v.917h1v-.917H0zm16 .917v-.917h-1v.917h1zm-16 .917v.458c0 .166.016.33.048.487l.98-.194A1.51 1.51 0 0 1 1 13.5v-.458H0zm16 .458v-.458h-1v.458c0 .1-.01.199-.029.293l.981.194c.032-.158.048-.32.048-.487zM.421 14.89c.183.272.417.506.69.689l.556-.831a1.51 1.51 0 0 1-.415-.415l-.83.556zm14.469.689c.272-.183.506-.417.689-.69l-.831-.556c-.11.164-.251.305-.415.415l.556.83zm-12.877.373c.158.032.32.048.487.048h.458v-1H2.5c-.1 0-.199-.01-.293-.029l-.194.981zM13.5 16c.166 0 .33-.016.487-.048l-.194-.98A1.51 1.51 0 0 1 13.5 15h-.458v1h.458zm-9.625 0h.917v-1h-.917v1zm1.833 0h.917v-1h-.917v1zm1.834-1v1h.916v-1h-.916zm1.833 1h.917v-1h-.917v1zm1.833 0h.917v-1h-.917v1zM8.5 4.5a.5.5 0 0 0-1 0v3h-3a.5.5 0 0 0 0 1h3v3a.5.5 0 0 0 1 0v-3h3a.5.5 0 0 0 0-1h-3v-3z"
          />
        </svg>
      </a>
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
        <span v-else>
          <label @click="day.edit = true"> {{ day.title }} </label>
        </span>

        <a
          href="#"
          class="text-decoration-none float-end"
          style="padding-top: 2px"
          @click="removeDay(index)"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            fill="currentColor"
            class="bi bi-trash"
            viewBox="0 0 16 16"
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
                  @change="onShowOnMap(day)"
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
                  v-model.lazy="day.gpx_url"
                  @change="onUpdateGPXURL(day)"
                  aria-label="url input"
                  aria-describedby="inputGroup-sizing-sm"
                />
              </div>
            </li>
          </ul>
        </div>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.draggable {
  cursor: pointer;
}
</style>