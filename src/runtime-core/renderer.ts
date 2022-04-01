import { isObject } from "../reactivity"
import { createComponentInstance, setupComponent } from "./component"
import { ShapeFlags } from "./ShapeFlags"
import { Fragment, Text } from "./vnode"

export function render(vnode, container) {
  patch(vnode, container, null)
}

function patch(vnode: any, container: any, parentComponent: any) {
  const { type, shapeFlag } = vnode

  switch (type) {
    // Fragment 只渲染子节点
    case Fragment:
      processFragment(vnode, container, parentComponent)
      break
    case Text:
      processText(vnode, container)
      break
    default:
      if (vnode.shapeFlag & ShapeFlags.ELEMENT) {
        // 处理DOM Element
        processElement(vnode, container, parentComponent)
      } else if (vnode.shapeFlag & ShapeFlags.STATEFUL_COMPONENT) {
        // 处理组件
        processComponent(vnode, container, parentComponent)
      }
  }
}

function processFragment(vnode: any, container: any, parentComponent: any) {
  mountChildren(vnode.children, container, parentComponent)
}

function processText(vnode: any, container: any) {
  const textNode = vnode.el = document.createTextNode(vnode.children)
  container.append(textNode)
}

function processElement(vnode: any, container: any, parentComponent: any) {
  mountElement(vnode, container, parentComponent)
}

function mountElement(vnode: any, container: any, parentComponent: any) {
  const { type, props, children, shapeFlag } = vnode
  // 把创建的dom传给vnode.el
  const el = vnode.el = document.createElement(type)

  if (shapeFlag & ShapeFlags.TEXT_CHILDREN) {
    // 文字节点
    el.textContent = children
  } else if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
    // 多个子节点
    mountChildren(children, el, parentComponent)
  }
  // 设置属性
  const isEvent = (key: string) => /^on[A-Z]/.test(key)
  for (const key in props) {
    // NOTE:注册事件
    if (isEvent(key)) {
      el.addEventListener(key.slice(2).toLowerCase(), props[key])
    }
    // 或者attribute
    el.setAttribute(key, props[key])
  }
  // 把dom挂载到container上
  container.append(el)
}

function mountChildren(children: any, container: any, parentComponent: any) {
  children.forEach(child => {
    // 再分为用vnode定义的DOM子节点和文本节点
    if (isObject(child)) {
      patch(child, container, parentComponent)
    }
    // 文字节点被抽离出去
    // else if (typeof child === 'string') {
    //   container.append(document.createTextNode(child))
    // }
  })
}

function processComponent(vnode: any, container: any, parentComponent: any) {
  mountComponent(vnode, container, parentComponent)
}

function mountComponent(vnode: any, container: any, parentComponent: any) {
  const instance = createComponentInstance(vnode, parentComponent)

  setupComponent(instance)
  setupRenderEffect(instance, container)
}

function setupRenderEffect(instance, container) {
  const { proxy } = instance
  // NOTE: setup注册的东西绑定在实例上, 都通过proxy获取
  // 用call把render的this绑定到proxy上,
  // 之后就能在render里用this来访问到instance的setup结果
  const subTree = instance.render.call(proxy)
  patch(subTree, container, instance)

  // NOTE: patch先进到mountElement, ele把dom挂到自己的vnode上,
  // 等children全部render完了, 才能把组件实例的el绑定到根dom元素
  // 这样就实现 $el 接口, 在proxy设置
  instance.vnode.el = subTree.el
}
