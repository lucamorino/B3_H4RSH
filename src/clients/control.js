export default {
    id: {
      type: 'float',
      default: 0,
      min: 0,
      max: 20,
    },
    active: {
      type: 'float',
      default: 0,
      min: 0,
      max: 1,
    },
    del: {
      type: 'float',
      default: 86,
      min: 1,
      max: 2000,
    },
    phase: {
      type: 'float',
      default: 160,
      min: 1,
      max: 2000,
    },
    bp: {
      type: 'float',
      default: 100,
      min: 1,
      max: 2000,
    },
    X: {
      type: 'float',
      default: 1,
      min: 0,
      max: 100,
    },
    Y: {
      type: 'float',
      default: 1,
      min: 0,
      max: 100,
    },
    Z: {
      type: 'float',
      default: 1,
      min: 0,
      max: 100,
    },
    collision: {
      type: 'float',
      default: 0,
      min: 0,
      max: 1,
    }
  };