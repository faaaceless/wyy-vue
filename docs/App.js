import { h } from "../lib/wyy-vue.esm.js"

export const App = {
    render() {
        return h("div", {}, this.msg)
    },
    setup() {
        return {
            msg: "hello world"
        }
    }
}