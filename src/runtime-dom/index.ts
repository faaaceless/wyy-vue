import { createRenderer } from "../runtime-core"
export * from "../runtime-core"

function createElement(type: any) {
  return document.createElement(type)
}

function patchProp(el: any, key: string, value: any) {
  const isEvent = (key: string) => /^on[A-Z]/.test(key)
  if (isEvent(key)) {
    // NOTE:注册事件
    el.addEventListener(key.slice(2).toLowerCase(), value)
  } else {
    // 或者attribute
    el.setAttribute(key, value)
  }
}

function insert(el: any, container: any) {
  container.append(el)
}

// 传入render参数, 返回的renderer包含createAppAPI调用的结果, 即重构前的createApp函数
const renderer: any = createRenderer({
  createElement,
  patchProp,
  insert,
})

// 再调用之前的createApp函数, 实际上就是在外面套了一层renderer, 通过这个renderer传入一些方法, 但是在js里调用方法不变
export function createApp(...args) {
  return renderer.createApp(...args)
}
