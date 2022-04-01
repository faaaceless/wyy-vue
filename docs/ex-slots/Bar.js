import { h } from "../../lib/wyy-vue.esm.js"

export const Bar = {
  setup(props, { emit }) {
    const tryEmit = () => {
      emit("tryemit", "this is tryemit event")
      emit("try-emit", "this is try-emit event")
    }
    return {
      tryEmit,
    }
  },
  render() {
    window.Bar = this
    const btn = h("button", { onClick: this.tryEmit }, "emit")
    return h("div", { class: "sayBye" }, [this.msg, btn])
  },
}
