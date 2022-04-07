import { effect, isObject } from "../reactivity"
import { createComponentInstance, setupComponent } from "./component"
import { createAppAPI } from "./createApp"
import { ShapeFlags } from "./ShapeFlags"
import { Fragment, Text } from "./vnode"

export function createRenderer(options) {
  const {
    createElement: hostCreateElement,
    patchProp: hostPatchProp,
    insert: hostInsert,
    remove: hostRemove,
    setElementText: hostSetElementText,
  } = options

  function render(vnode, container) {
    patch(null, vnode, container, null)
  }

  // n1:prevVnode n2:curVnode
  function patch(n1: any, n2: any, container: any, parentComponent: any) {
    const { type, shapeFlag } = n2

    switch (type) {
      // Fragment 只渲染子节点
      case Fragment:
        processFragment(n1, n2, container, parentComponent)
        break
      case Text:
        processText(n1, n2, container)
        break
      default:
        if (shapeFlag & ShapeFlags.ELEMENT) {
          // 处理DOM Element
          processElement(n1, n2, container, parentComponent)
        } else if (shapeFlag & ShapeFlags.STATEFUL_COMPONENT) {
          // 处理组件
          processComponent(n1, n2, container, parentComponent)
        }
    }
  }

  function processFragment(n1: any, n2: any, container: any, parentComponent: any) {
    mountChildren(n2.children, container, parentComponent)
  }

  function processText(n1: any, n2: any, container: any) {
    const textNode = (n2.el = document.createTextNode(n2.children))
    container.append(textNode)
  }

  function processElement(n1: any, n2: any, container: any, parentComponent: any) {
    // 没有n1走初始化， 有n1走更新
    if (!n1) {
      mountElement(n2, container, parentComponent)
    } else {
      patchElement(n1, n2, container, parentComponent)
    }
  }

  function patchElement(n1: any, n2: any, container: any, parentComponent: any) {
    console.log(n1, n2)

    // n1经历了mountElement 而n2还没有，所以只能从n1读dom
    const el = (n2.el = n1.el)

    // 更新props
    const prevProps = n1.props ?? {}
    const curProps = n2.props ?? {}

    patchChildren(n1, n2, el, parentComponent)
    patchProps(prevProps, curProps, el)
  }

  function patchChildren(n1: any, n2: any, el: any, parentComponent: any) {
    const { shapeFlag: preShapeFlag } = n1
    const { shapeFlag: curShapeFlag } = n2

    if (curShapeFlag & ShapeFlags.TEXT_CHILDREN) {
      // unmount 如果是Array to Text
      unmountChildren(n1.children)
      if (n1.children !== n2.children) {
        hostSetElementText(el, n2.children)
      }
    } else {
      if (preShapeFlag & ShapeFlags.TEXT_CHILDREN) {
        // 清空之前的文本
        hostSetElementText(el, "")
        // mount 新的
        mountChildren(n2.children, el, parentComponent)
      }
    }
  }

  function unmountChildren(children: any) {
    for (let i = 0; i < children.length; i++) {
      const el = children[i].el
      hostRemove(el)
    }
  }

  function patchProps(prevProps: any, curProps: any, el: any) {
    if (prevProps === curProps) return

    for (const key in curProps) {
      const prevProp = prevProps[key]
      const curProp = curProps[key]
      // 新值不等于老值, 以前不存在的prop也包含在内
      if (prevProp !== curProp) {
        hostPatchProp(el, key, prevProp, curProp)
      }
    }
    // 删除不再存在的prop
    for (const key in prevProps) {
      if (!(key in curProps)) {
        hostPatchProp(el, key, prevProps[key], null)
      }
    }
  }

  function mountElement(vnode: any, container: any, parentComponent: any) {
    const { type, props, children, shapeFlag } = vnode
    // 把创建的dom传给vnode.el
    const el = (vnode.el = hostCreateElement(type))

    if (shapeFlag & ShapeFlags.TEXT_CHILDREN) {
      // 文字节点
      el.textContent = children
    } else if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
      // 多个子节点
      mountChildren(children, el, parentComponent)
    }
    // 设置属性
    for (const key in props) {
      hostPatchProp(el, key, null, props[key])
    }

    // 把dom挂载到container上
    hostInsert(el, container)
  }

  function mountChildren(children: any, container: any, parentComponent: any) {
    children.forEach((child) => {
      // 再分为用vnode定义的DOM子节点和文本节点
      if (isObject(child)) {
        patch(null, child, container, parentComponent)
      }
    })
  }

  function processComponent(n1: any, n2: any, container: any, parentComponent: any) {
    mountComponent(n2, container, parentComponent)
  }

  function mountComponent(vnode: any, container: any, parentComponent: any) {
    const instance = createComponentInstance(vnode, parentComponent)

    setupComponent(instance)
    setupRenderEffect(instance, container)
  }

  function setupRenderEffect(instance, container) {
    // 用effect包裹, 在响应对象发生改变后，会再次触发render
    effect(() => {
      if (!instance.isMounted) {
        const { proxy } = instance
        // NOTE: setup注册的东西绑定在实例上, 都通过proxy获取
        // 用call把render的this绑定到proxy上,
        // 之后就能在render里用this来访问到instance的setup结果
        const subTree = (instance.subTree = instance.render.call(proxy))
        // subTree 就是组件的虚拟dom树
        patch(null, subTree, container, instance)

        // NOTE: patch先进到mountElement, el把dom挂到自己的vnode上,
        // 等children全部render完了, 才能把组件实例的el绑定到根dom元素
        // 这样就实现 $el 接口, 在proxy设置
        instance.vnode.el = subTree.el

        instance.isMounted = true
      } else {
        const { proxy } = instance
        const prevTree = instance.subTree
        const subTree = (instance.subTree = instance.render.call(proxy))
        patch(prevTree, subTree, container, instance)
      }
    })
  }

  return {
    createApp: createAppAPI(render),
  }
}
