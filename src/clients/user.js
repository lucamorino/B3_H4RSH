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
    winner: {
      type: 'boolean',
      default: false,
    },
    fb_gain: {
      type: 'float',
      default: 0.36,
      min: 0.001,
      max: 3.99,
    },
    fb_trim: {
      type: 'float',
      default: 0.36,
      min: 0.001,
      max: 3.99,
    },
    bp_q: {
      type: 'float',
      default: 0.6,
      min: 0.001,
      max: 0.99,
    },
    phase_q: {
      type: 'float',
      default: 0.6,
      min: 0.001,
      max: 0.99,
    },
  };