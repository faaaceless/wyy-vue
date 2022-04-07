import { createRenderer } from "../runtime-core"
export * from "../runtime-core"

function createElement(type: any) {
  return document.createElement(type)
}

function patchProp(el: any, key: string, prevVal: any, curVal: any) {
  const isEvent = (key: string) => /^on[A-Z]/.test(key)
  // NOTE:注册事件或者attribute
  if (isEvent(key)) {
    el.addEventListener(key.slice(2).toLowerCase(), curVal)
  } else {
    // 新的prop是 undefined or null，则删除
    if (curVal === undefined || curVal === null) {
      el.removeAttribute(key)
    } else {
      el.setAttribute(key, curVal)
    }
  }
}

function insert(el: any, container: any) {
  container.append(el)
}

function remove(child: any) {
  const parent = child.parentNode
  if (parent) {
    parent.removeChild(child)
  }
}

function setElementText(el: any, text: any) {
  el.textContent = text
}

// 传入render参数, 返回的renderer包含createAppAPI调用的结果, 即重构前的createApp函数
const renderer: any = createRenderer({
  createElement,
  patchProp,
  insert,
  remove,
  setElementText,
})

// 再调用之前的createApp函数, 实际上就是在外面套了一层renderer, 通过这个renderer传入一些方法, 但是在js里调用方法不变
// 整个流程是createRenderer-(options)->render-(render)->createAppAPI-(render)->createApp-(args)->render
export function createApp(...args) {
  return renderer.createApp(...args)
}
