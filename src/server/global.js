// src/server/schemas/global.js
export default {
  running: {
    type: 'boolean',
    default: false,
  },
  syncTriggerTime: {
    type: 'float',
    default: 0,
  },
  goal: {
    type: 'any',
    default: [30, 30, 30],
  },
  penalty: {
    type: 'float',
    default: 0,
    min: 0,
    max: 20,
  },
  hrsh_threshold: {
    type: 'float',
    default: 0.575,
    min: 0.1,
    max: 0.99,
  },
};