export default {
    id: {
      type: 'float',
      default: 0,
      min: 0,
      max: 20,
    },
    volume: {
      type: 'float',
      default: 1,
      min: 0,
      max: 1,
    },
    harsh: {
      type: 'float',
      default: 0,
      min: 0,
      max: 1,
    },
    penalty: {
      type: 'float',
      default: 0,
      min: 0,
      max: 1,
    },
    LFO: {
      type: 'float',
      default: 0,
      min: 0,
      max: 1,
    },
    life: {
      type: 'float',
      default: 10,
      min: 0,
      max: 10,
    },
    style: {
      type: 'any',
      default: [],
    },
    zone: {
      type: 'float',
      default: 0,
      min: 0,
      max: 7,
    },
    collide: {
      type: 'boolean',
      default: false,
    },
    proximity: {
      type: 'boolean',
      default: false,
    },
    periphery: {
      type: 'boolean',
      default: false,
    },
    preset: {
      type: 'float',
      default: 0,
      min: 0,
      max: 20,
    },
  };