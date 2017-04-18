import presets from './presets'
import Animation from './Animation'
import { now, isArray, isObject } from './utils'

export default {
  data () {
    return {
      currentValues: null,
      currentVelocities: null,
    }
  },

  props: {
    value: Number,
    values: [Object, Array],
    tag: {
      type: String,
      default: 'span',
    },
    spring: {
      type: [Object, String],
      default: 'noWobble',
    },
  },

  computed: {
    springConfig () {
      return typeof this.spring === 'string'
        ? presets[this.spring]
        : this.spring
    },
    realValues () {
      return this.value != null
        ? { value: this.value }
        : this.values
    },
  },

  render (h) {
    return h(this.tag, [
      this.$scopedSlots.default(this.currentValues),
    ])
  },

  watch: {
    realValues (current, old) {
      if (old !== current && !this.wasAnimating) {
        this.prevTime = now()
        this.accumulatedTime = 0
        this.animate()
      }
    },
  },

  created () {
    const current = this.defineInitialValues(this.realValues, null)

    this.currentValues = current.values
    this.currentVelocities = current.velocities
  },

  mounted () {
    this.prevTime = now()
    this.accumulatedTime = 0

    const ideal = this.defineInitialValues(this.currentValues, this.currentVelocities)

    this.idealValues = ideal.values
    this.idealVelocities = ideal.velocities

    this.animate()
  },

  methods: {
    defineInitialValues (values, velocities) {
      const newValues = {}
      const newVelocities = {}

      this.defineValues(values, velocities, newValues, newVelocities)

      return { values: newValues, velocities: newVelocities }
    },

    defineValues (values, velocities, newValues, newVelocities) {
      for (const key in values) {
        // istanbul ignore if
        if (!Object.prototype.hasOwnProperty.call(values, key)) continue

        if (isArray(values[key]) || isObject(values[key])) {
          newValues[key] = {}
          newVelocities[key] = {}

          this.defineValues(
            values[key],
            velocities ? velocities[key] : null,
            newValues[key],
            newVelocities[key]
          )

          continue
        }

        newValues[key] = values[key]
        newVelocities[key] = velocities ? velocities[key] : 0
      }
    },

    animate () {
      const animation = new Animation()

      animation.step(this.realValues, {
        vm: this,

        spring: this.springConfig,

        ideal: {
          values: this.idealValues,
          velocities: this.idealVelocities,
        },

        current: {
          values: this.currentValues,
          velocities: this.currentVelocities,
        },
      })
    },
  },
}
