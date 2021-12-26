<script>
export default {
  data() {
    return {
      days: [],
    };
  },
  methods: {
    toStr: function (str, index) {
      return str + "-" + index;
    },
    addDay: function () {
      this.days.push({id : this.days.length});
    },
    removeDay: function (index) {
      console.log(index);
      this.days.splice(index, 1);
    },
  },
};
</script>

<template>
  <main>
    <div
      class="flex-shrink-0 p-3 bg-white"
      style="width: 280px; position: relative"
    >
      <div class="d-flex align-items-center pb-3 mb-3 link-dark border-bottom">
        <span class="fs-4 fw-semibold">Routes list</span>
        <a href="#" class="text-decoration-none ms-auto" @click="addDay">
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
            ></path>
            <path
              d="M8 4a.5.5 0 0 1 .5.5v3h3a.5.5 0 0 1 0 1h-3v3a.5.5 0 0 1-1 0v-3h-3a.5.5 0 0 1 0-1h3v-3A.5.5 0 0 1 8 4z"
            ></path>
          </svg>
        </a>
      </div>
      <ul
        class="list-unstyled ps-0"
        :key="day.id"
        v-for="(day, index) in days"
      >
        <li class="mb-1">
          <button
            class="btn btn-toggle align-items-center rounded"
            data-bs-toggle="collapse"
            v-bind:data-bs-target="toStr('#day', index)"
            aria-expanded="true"
          >
            Day {{ index + 1 }}
          </button>
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
              class="bi bi-dash-square"
              viewBox="0 0 16 16"
            >
              <path
                d="M14 1a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1h12zM2 0a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V2a2 2 0 0 0-2-2H2z"
              ></path>
              <path
                d="M4 8a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 0 1h-7A.5.5 0 0 1 4 8z"
              ></path>
            </svg>
          </a>

          <div class="collapse show ms-auto" v-bind:id="toStr('day', index)">
            <ul
              class="btn-toggle-nav list-unstyled fw-normal pb-1 small"
              style="padding: 0.25rem 0.5rem"
            >
              <li>
                <div class="form-check form-switch">
                  <input
                    class="form-check-input"
                    type="checkbox"
                    v-bind:id="toStr('flexSwitchCheckChecked', index)"
                    checked
                  />
                  <label class="form-check-label" v-bind:for="toStr('flexSwitchCheckChecked', index)">Show on map</label>
                </div>
                <div class="input-group input-group-sm mb-3">
                  <span class="input-group-text" id="inputGroup-sizing-sm"
                    >URL</span
                  >
                  <input
                    type="text"
                    class="form-control"
                    aria-label="Sizing example input"
                    aria-describedby="inputGroup-sizing-sm"
                  />
                </div>
              </li>
            </ul>
          </div>
        </li>
      </ul>
    </div>
  </main>
</template>

<style scoped>
</style>