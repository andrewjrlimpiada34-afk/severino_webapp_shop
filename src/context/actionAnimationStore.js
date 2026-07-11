import { createContext } from 'react'

const ActionAnimationContext = createContext({
  playActionAnimation: () => Promise.resolve(),
})

export default ActionAnimationContext
