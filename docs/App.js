import { h } from "../lib/wyy-vue.esm.js"

export const App = {
    render() {
        window.self = this
        return h("div", { class: "sayHi" }, [
            this.msg,
            h("div", { class: "sayBye" }, "bye"),
        ])
    },
    setup() {
        return {
            msg: "hello world",
        }
    },
}
