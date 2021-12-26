<script setup>
import Map from './components/Map.vue'
import Route from './components/Route.vue'
</script>

<template>
  <Map/>
  <Route/>
</template>

<style>
@import 'bootstrap/dist/css/bootstrap.min.css';
@import "../node_modules/ol/ol.css";
@import './assets/styles/sidebars.css';

#app {
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;  
   margin-top: 60px;
}
</style>
