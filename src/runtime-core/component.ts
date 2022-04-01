import { shallowReadonly } from "../reactivity"
import { initProps } from "./componentProps"
import { PublicInstanceProxyHandlers } from "./componentPublicInstance"
import { emit } from "./componentEmit"
import { initSlots } from "./componentSlots"

export function createComponentInstance(vnode: any, parent: any) {
  const instance = {
    vnode,
    setupState: {},
    props: {},
    slots: {},
    provides: {},
    parent,
    emit: (event) => {},
  }

  // instance直接作为bind的参数，无需另外传入
  instance.emit = emit.bind(null, instance)
  return instance
}
// NOTE: 这页注册组件主要实现几个功能:
// 1.把setup的结果挂载到组件实例上
// 2.把render方法挂载到组件实例上
export function setupComponent(instance: any) {
  // 把组件的props挂到组件实例上
  initProps(instance, instance.vnode.props)
  // 把slots挂到组件实例
  initSlots(instance, instance.vnode.children)
  setupStatefulComponent(instance)
}

function setupStatefulComponent(instance: any) {
  const component = instance.vnode.type

  const { setup } = component
  // 执行setup
  if (setup) {
    // 可以在setup里执行getCurrentInstance
    setCurrentInstance(instance)
    // props可以作为setup的输入, 并且是readonly的
    // NOTE: 这里emit忘记传入instance.emit, 导致传入导入的emit，debug半天
    const setupRes = setup(shallowReadonly(instance.props), {
      emit: instance.emit,
    })

    setCurrentInstance(null)
    handleSetupResult(setupRes, instance)
  }

  // 任意代理一个对象, 返回setup结果
  // 主要是用于绑定render的this指向
  instance.proxy = new Proxy({ _: instance }, PublicInstanceProxyHandlers)
}

function handleSetupResult(setupRes, instance) {
  if (typeof setupRes === "object") {
    instance.setupState = setupRes
  }

  finishComponentSetup(instance)
}

function finishComponentSetup(instance: any) {
  const component = instance.vnode.type
  // 挂载render方法至实例
  if (component.render) {
    instance.render = component.render
  }
}

let currentInstance: any = null

export function getCurrentInstance() {
  return currentInstance
}

// NOTE: 相比于在上边写死, 抽离出来的好处在于出问题方便跟踪, 就在这个函数打断点
function setCurrentInstance(val: any) {
  currentInstance = val
}
