import { h } from "../lib/wyy-vue.esm.js"
import { Foo } from "./Foo.js"

export const App = {
    render() {
        return h("div", { class: "sayHi", onClick: () => console.log('click') }, [
            this.msg,
            h("div", { class: "sayBye", onMouseenter: () => console.log('enter') }, "bye"),
            h(Foo, { msg: "this is foo" }),
        ])
    },
    setup() {
        return {
            msg: "hello world",
        }
    },
}
