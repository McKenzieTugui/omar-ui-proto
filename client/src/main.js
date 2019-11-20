import Vue from 'vue'
import App from './App.vue'
import router from './router'
import vuetify from './plugins/vuetify';
import store from './store'
import '@babel/polyfill'
import 'intersection-observer'

Vue.config.productionTip = false

export default new Vue({
  router,
  vuetify,
  store,
  render: h => h(App)
}).$mount('#app')

