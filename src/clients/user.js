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
    LFO: {
      type: 'float',
      default: 0,
      min: 0,
      max: 1,
    },
    goal: {
    type: 'any',
    default: [30, 30, 30],
    },
    life: {
      type: 'boolean',
      default: true,
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
    del_range: {
      type: 'float',
      default: 90,
      min: 0,
      max: 180,
    },
    del_offset: {
      type: 'float',
      default: 86,
      min: 1,
      max: 180,
    },
    phase_range: {
      type: 'float',
      default: 80,
      min: 0,
      max: 180,
    },
    phase_offset: {
      type: 'float',
      default: 160,
      min: 1,
      max: 240,
    },
    bp_range: {
      type: 'float',
      default: 100,
      min: 0,
      max: 180,
    },
    bp_offset: {
      type: 'float',
      default: 150,
      min: 1,
      max: 240,
    },
    fb_gain: {
      type: 'float',
      default: 1.2,
      min: 0.001,
      max: 1.99,
    },
    fb_trim: {
      type: 'float',
      default: 0.44,
      min: 0.01,
      max: 1,
    },
  };