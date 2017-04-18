import stepper from './stepper'
import { raf, now, isArray, isObject } from './utils'

const msPerFrame = 1000 / 60

export default class Animation {
  step (fromState, context = {}) {
    context.now = now()

    context.animationID = raf(() => {
      this.animate(fromState, context)

      // out of the update loop
      context.animationID = null
      // the amount we're looped over above
      context.accumulatedTime -= context.framesToCatchUp * msPerFrame

      // keep going!
      this.step(fromState, context)
    })
  }

  animate (fromState, context) {
    const fireEvent = context.vm.$emit.bind(context.vm) || function () {}

    if (this.shouldStop(
      fromState,
      context.current.values,
      context.current.velocities
    )) {
      if (context.wasAnimating) fireEvent('motion-end')

      // reset everything for next animation
      context.animationId = null
      context.wasAnimating = false
      return
    }

    if (!context.wasAnimating) fireEvent('motion-start')
    context.wasAnimating = true

    // get time from last frame
    const currentTime = now()
    const timeDelta = currentTime - context.prevTime
    context.prevTime = currentTime
    context.accumulatedTime += timeDelta

    // more than 10 frames? prolly switched browser tab. Restart
    if (context.accumulatedTime > msPerFrame * 10) {
      context.accumulatedTime = 0
    }

    if (context.accumulatedTime === 0) {
      // no need to cancel animationID here; shouldn't have any in flight
      context.animationID = null
      fireEvent('motion-restart')
      this.run(fromState, context)
      return
    }

    context.currentFrameCompletion =
      (context.accumulatedTime - Math.floor(context.accumulatedTime / msPerFrame) * msPerFrame) / msPerFrame
    context.framesToCatchUp = Math.floor(context.accumulatedTime / msPerFrame)

    this.animateValues(fromState, context)
  }

  animateValues (fromState, context) {
    for (const key in fromState) {
      // istanbul ignore if
      if (!Object.prototype.hasOwnProperty.call(fromState, key)) continue

      if (isArray(fromState[key]) || isObject(fromState[key])) {
        this.animateValues(
          fromState[key],
          {
            ...context,
            current: {
              values: context.current.values[key],
              velocities: context.current.velocities[key],
            },
            ideal: {
              values: context.ideal.values[key],
              velocities: context.ideal.velocities[key],
            },
          }
        )

        continue
      }

      let newIdealValue = context.ideal.values[key]
      let newIdealVelocity = context.ideal.velocities[key]
      const value = fromState[key]

      // iterate as if the animation took place
      for (let i = 0; i < context.framesToCatchUp; i++) {
        ;[newIdealValue, newIdealVelocity] = stepper(
          msPerFrame / 1000,
          newIdealValue,
          newIdealVelocity,
          value,
          context.spring.stiffness,
          context.spring.damping,
          context.spring.precision
        )
      }

      const [nextIdealValue, nextIdealVelocity] = stepper(
        msPerFrame / 1000,
        newIdealValue,
        newIdealVelocity,
        value,
        context.spring.stiffness,
        context.spring.damping,
        context.spring.precision
      )

      context.current.values[key] =
        newIdealValue +
        (nextIdealValue - newIdealValue) * context.currentFrameCompletion
      context.current.velocities[key] =
        newIdealVelocity +
        (nextIdealVelocity - newIdealVelocity) * context.currentFrameCompletion
      context.ideal.values[key] = newIdealValue
      context.ideal.velocities[key] = newIdealVelocity
    }
  }

  shouldStop (fromState, currentValues, currentVelocities) {
    for (const key in fromState) {
      // istanbul ignore if
      if (!Object.prototype.hasOwnProperty.call(fromState, key)) continue

      if (isArray(fromState[key]) || isObject(fromState[key])) {
        if (this.shouldStop(fromState[key], currentValues[key], currentVelocities[key])) {
          return true
        }
      }

      if (currentVelocities[key] !== 0) return false

      // stepper will have already taken care of rounding precision errors, so
      // won't have such thing as 0.9999 !=== 1
      if (currentValues[key] !== fromState[key]) return false
    }

    return true
  }
}
