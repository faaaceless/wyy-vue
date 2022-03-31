import { h } from "../../lib/wyy-vue.esm.js"
export const Foo = {
  render() {
    // 这时候拿不到el, el在children render完了才能拿
    window.Foo = this
    console.log("------test &props------")
    console.log(this.$props)
    return h("div", {}, "foo: " + this.msg)
  },
  setup(props) {
    props.msg = "It should be readonly"
  }
}