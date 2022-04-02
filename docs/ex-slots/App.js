import { h, createTextVNode } from "../../lib/wyy-vue.esm.js"
import { Foo } from "./Foo.js"

export const App = {
  render() {
    const hello = h("div", { class: "sayHi" }, this.msg)
    const child1 = ({ msg }) => [
      h("p", {}, "1st p:" + msg),
      createTextVNode("再加个文字节点"),
    ]
    const child2 = () => h("p", {}, "2nd p")
    const foo = h(Foo, {}, { child2, child1 })
    return h("div", {}, [hello, foo, createTextVNode("End here")])
  },
  setup() {
    return {
      msg: "hello world",
    }
  },
}
