import { useContext } from 'react'
import ActionAnimationContext from './actionAnimationStore.js'

function useActionAnimation() {
  return useContext(ActionAnimationContext)
}

export { useActionAnimation }
