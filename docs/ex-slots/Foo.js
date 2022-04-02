import { h, renderSlots } from "../../lib/wyy-vue.esm.js"
export const Foo = {
  render() {
    window.Foo = this

    const msg = "作用域插槽"
    const foo = h("p", {}, "foo")
    return h("div", { class: "sayBye" }, [
      renderSlots(this.$slots, "child1", { msg }),
      foo,
      renderSlots(this.$slots, "child2"),
    ])
  },

  setup(props) {
    return {}
  },
}
