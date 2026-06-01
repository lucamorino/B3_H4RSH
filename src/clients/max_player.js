import '@soundworks/helpers/polyfills.js';
import { Client } from '@soundworks/core/client.js';
import { loadConfig } from '@soundworks/helpers/node.js';
import Max from 'max-api';
import ClientPluginLogger from '@soundworks/plugin-logger/client.js';
import pluginSync from '@soundworks/plugin-sync/client.js'; 
import pluginCheckin from '@soundworks/plugin-checkin/client.js'; 

// - General documentation: https://soundworks.dev/
// - API documentation:     https://soundworks.dev/api
// - Issue Tracker:         https://github.com/collective-soundworks/soundworks/issues
// - Wizard & Tools:        `npx soundworks`

/**
 * Warning: This client is meant to run within a Max node.script object
 * - https://docs.cycling74.com/reference/node.script/
 * - https://docs.cycling74.com/apiref/nodeformax/
 */

const ENV = 'default';
const config = loadConfig(ENV, import.meta.url);
const client = new Client(config);

client.pluginManager.register('logger', ClientPluginLogger);


await client.start();

const logger = await client.pluginManager.get('logger');
const logWriter = await logger.createWriter('session-log', { bufferSize: 50 });
let logTimerId = null;
const LOG_INTERVAL_MS = 100;

const global = await client.stateManager.attach('global');
const userCollection = await client.stateManager.getCollection('user');
const controlCollection = await client.stateManager.getCollection('control');

const userStates = new Map();
const userUpdateUnsubs = new Map();
const controlStates = new Map();
const controlUpdateUnsubs = new Map();

const serializeUserState = (state) => ({
  id: state.get('id'),
  volume: state.get('volume'),
  harsh: state.get('harsh'),
  penalty: state.get('penalty'),
  LFO: state.get('LFO'),
  life: state.get('life'),
  style: state.get('style'),
  zone: state.get('zone'),
  collide: state.get('collide'),
  proximity: state.get('proximity'),
  periphery: state.get('periphery'),
  preset: state.get('preset'),
});

const serializeControlState = (state) => ({
  id: state.get('id'),
  X: state.get('X'),
  Y: state.get('Y'),
  Z: state.get('Z'),
  active: state.get('active'),
  collision: state.get('collision'),
});

const emitUserParameters = () => {
  Max.outlet('user', Array.from(userStates.values()).map(serializeUserState));
};

const emitControlCoordinates = () => {
  Max.outlet('control', Array.from(controlStates.values()).map(serializeControlState));
};

const reportHarshPenalty = (state) => {
  const harsh = state.get('harsh');
  const penalty = state.get('penalty');

  Max.outlet('harsh_penalty', {
    id: state.id,
    harsh,
    penalty,
  });
};

userCollection.onAttach((state) => {
  userStates.set(state.id, state);
  const off = state.onUpdate((updates) => {
    if ('harsh' in updates || 'penalty' in updates) {
      reportHarshPenalty(state);
    }
    emitUserParameters();
  });

  if (typeof off === 'function') {
    userUpdateUnsubs.set(state.id, off);
  }

  reportHarshPenalty(state);
  emitUserParameters();
}, true);

userCollection.onDetach((state) => {
  userStates.delete(state.id);
  const off = userUpdateUnsubs.get(state.id);
  if (typeof off === 'function') {
    off();
  }
  userUpdateUnsubs.delete(state.id);
  emitUserParameters();
});

controlCollection.onAttach((state) => {
  controlStates.set(state.id, state);
  const off = state.onUpdate(() => {
    emitControlCoordinates();
  });

  if (typeof off === 'function') {
    controlUpdateUnsubs.set(state.id, off);
  }

  emitControlCoordinates();
}, true);

controlCollection.onDetach((state) => {
  controlStates.delete(state.id);
  const off = controlUpdateUnsubs.get(state.id);
  if (typeof off === 'function') {
    off();
  }
  controlUpdateUnsubs.delete(state.id);
  emitControlCoordinates();
});

function getLogSample(type = 'sample', extras = {}) {
  return {
    time: performance.now(),
    type,
    players: Array.from(userStates.values()).map((userState) => {
      const extId = userState.get('id');
      const controlState = Array.from(controlStates.values()).find(
        (c) => c.get('id') === extId,
      );
      return {
        id: extId,
        active: controlState?.get('active') ?? null,
        padX: controlState?.get('X') ?? null,
        padY: controlState?.get('Y') ?? null,
        slider: controlState?.get('Z') ?? null,
        harsh: userState.get('harsh'),
        penalty: userState.get('penalty'),
      };
    }),
    ...extras,
  };
}

function startLogTimer() {
  if (logTimerId !== null) return;
  logWriter.write(getLogSample());
  logTimerId = setInterval(() => logWriter.write(getLogSample()), LOG_INTERVAL_MS);
}

function stopLogTimer() {
  if (logTimerId !== null) {
    clearInterval(logTimerId);
    logTimerId = null;
  }
  logWriter?.flush?.();
}

process.on('beforeExit', stopLogTimer);

global.onUpdate((updates) => {
  Max.outlet('global', updates);
  if (logTimerId !== null) {
    logWriter.write(getLogSample('global_update', { updates }));
  }
  if ('running' in updates) {
    if (updates.running) {
      startLogTimer();
    } else {
      stopLogTimer();
    }
  }
}, true);

userCollection.onChange(() => {
  emitUserParameters();
});

controlCollection.onChange(() => {
  emitControlCoordinates();
});

console.log(`Hello ${client.config.app.name}!`);

Max.addHandler('hello', () => Max.outlet('world'));
Max.addHandler('running', (running) => global.set({ running: Boolean(running) }));
Max.addHandler('goal', (...values) => global.set({ goal: values }));
Max.addHandler('preset', (userId, index) => {
  if (userId === -1) {
    userCollection.forEach((state) => state.set({ preset: index }));
  } else {
    const state = Array.from(userStates.values()).find((s) => s.get('id') === userId);
    state?.set({ preset: index });
  }
});

Max.addHandler('collision_distance', (distance) => global.set({ collision_distance: distance }));
Max.addHandler('proximity_offset', (offset) => global.set({ proximity_offset: offset }));
Max.addHandler('periphery_offset', (offset) => global.set({ periphery_offset: offset }));
Max.addHandler('hrsh_threshold', (threshold) => global.set({ hrsh_threshold: threshold }));
  
