import { h, provide, inject } from "../../lib/wyy-vue.esm.js"

const Provider = {
  name: "Provider",
  setup() {
    provide("foo", "1st fooVal")
    provide("bar", "1st barVal")
  },
  render() {
    return h("div", {}, [h("p", {}, "Provider"), h(ProviderTwo)])
  },
}

const ProviderTwo = {
  name: "ProviderSecond",
  setup() {
    provide("foo", "2nd fooVal")
    const foo = inject("foo")

    return {
      foo,
    }
  },
  render() {
    return h("div", {}, [
      h("p", {}, `ProviderSecond foo: ${this.foo}`),
      h(Consumer),
    ])
  },
}

const Consumer = {
  name: "Consumer",
  setup() {
    const foo = inject("foo")
    const bar = inject("bar")
    // const baz = inject("baz", "bazDefault");
    const baz = inject("baz", () => "bazDefault")

    return {
      foo,
      bar,
      baz,
    }
  },

  render() {
    return h("div", {}, `Consumer: - ${this.foo} - ${this.bar} - ${this.baz}`)
  },
}

export default {
  name: "App",
  setup() {
    provide()
  },
  render() {
    return h("div", {}, [h("p", {}, "apiInject"), h(Provider)])
  },
}
