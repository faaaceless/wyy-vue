import { h } from "../../lib/wyy-vue.esm.js"
import { Foo } from "./Foo.js"
import { Bar } from "./Bar.js"

export const App = {
  render() {
    return h("div", { class: "sayHi" }, [
      this.msg,
      h("div", { class: "sayBye", onMouseenter: () => console.log('enter bye') }, "bye"),
      h(Foo, { msg: "this is foo" }),
      h(Bar, {
        msg: "this is bar",
        onTryemit: (...args) => console.log("Receive tryemit, with args:", args),
        onTryEmit: (...args) => console.log("Receive try-emit, with args:", args),
      }),
    ])
  },
  setup() {
    return {
      msg: "hello world",
    }
  },
}
