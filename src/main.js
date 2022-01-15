
import { createApp } from 'vue'
import App from './App.vue'

import 'bootstrap'

const app = createApp(App);
app.mount('#app')

String.prototype.format = function () {
  let a = this;
  for (let k in arguments) {
    a = a.replace("{" + k + "}", arguments[k])
  }
  return a
}