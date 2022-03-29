import { shallowReadonly } from "../reactivity"
import { initProps } from "./componentProps"
import { PublicInstanceProxyHandlers } from "./componentPublicInstance"

export function createComponentInstance(vnode: any) {

  const instance = {
    vnode,
    setupState: {},
    props: {}
  }
  return instance
}
// NOTE: 这页注册组件主要实现几个功能:
// 1.把setup的结果挂载到组件实例上
// 2.把render方法挂载到组件实例上
export function setupComponent(instance: any) {
  // 把组件的props挂到组件实例上
  initProps(instance, instance.vnode.props)
  setupStatefulComponent(instance)
}

function setupStatefulComponent(instance: any) {
  const component = instance.vnode.type

  const { setup } = component
  // 执行setup
  if (setup) {
    // props可以作为setup的输入, 并且是readonly的
    const setupRes = setup(shallowReadonly(instance.props))
    handleSetupResult(setupRes, instance)
  }

  // 任意代理一个对象, 返回setup结果
  // 主要是用于绑定render的this指向
  instance.proxy = new Proxy({ _: instance }, PublicInstanceProxyHandlers)
}

function handleSetupResult(setupRes, instance) {

  if (typeof setupRes === 'object') {
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

