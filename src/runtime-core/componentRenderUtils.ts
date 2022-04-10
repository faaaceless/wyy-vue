export function shouldUpdateComponent(n1: any, n2: any) {
  const { props: prevProps } = n1
  const { props: curProps } = n2

  for (const key in curProps) {
    if (curProps[key] !== prevProps[key]) {
      return true
    }
  }

  return false
}
