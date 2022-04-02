import { h } from "../../lib/wyy-vue.esm.js"

export const App = {
  setup() {
    return {
      x: 250,
      y: 250,
    }
  },
  render() {
    return h("rect", { x: this.x, y: this.y })
  },
}
