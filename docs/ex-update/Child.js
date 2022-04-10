import { h } from "../../lib/wyy-vue.esm.js"
export default {
  name: "Child",
  setup(props, { emit }) {},
  render(proxy) {
    window.Child = this
    return h("div", {}, [h("div", {}, "child - props - msg: " + this.$props.msg)])
  },
}
