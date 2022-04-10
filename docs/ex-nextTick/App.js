import { h, ref, getCurrentInstance, nextTick } from "../../lib/wyy-vue.esm.js"

export default {
  name: "App",
  setup() {
    const count = ref(1)
    const instance = getCurrentInstance()

    function onClick() {
      for (let i = 0; i < 100; i++) {
        console.log("update")
        count.value = i
      }

      console.log(instance.vnode.el.textContent)
      nextTick(() => {
        console.log(instance.vnode.el.textContent)
      })
    }

    return {
      onClick,
      count,
    }
  },
  render() {
    const button = h("button", { onClick: this.onClick }, "update")
    const p = h("p", {}, "count:" + this.count)

    return h("div", {}, [button, p])
  },
}
