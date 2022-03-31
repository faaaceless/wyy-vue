export function emit(instance, event, ...args) {
  const { props } = instance
  console.log("------test emit------")
  console.log("Emit", event)

  const handler = props[toHandlerKey(event)]
  handler && handler(...args)
}

function toHandlerKey(val) {
  // 把kebab case转变成camel case
  const camelize = (str: string) => str.replace(/-(\w)/g, (_, c) => c ? c.toUpperCase() : "")
  const capitalize = (str: string) => str.charAt(0).toUpperCase() + str.slice(1)
  const handlerKey = (str: string) => (str ? "on" + capitalize(str) : "")

  return handlerKey(camelize(val))
}
