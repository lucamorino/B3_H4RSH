import '@soundworks/helpers/polyfills.js';
import '@soundworks/helpers/catch-unhandled-errors.js';
import { Server } from '@soundworks/core/server.js';
import { loadConfig, configureHttpRouter } from '@soundworks/helpers/server.js';
//import { WebSocketServer } from 'ws';
// 1. Import the `configureMaxClient` function from the @soundworks/max package
import { configureMaxClient } from '@soundworks/max';
//import { loadConfig } from '../utils/load-config.js';

import pluginPlatformInit from '@soundworks/plugin-platform-init/server.js'; 
import pluginSync from '@soundworks/plugin-sync/server.js'; 
import pluginCheckin from '@soundworks/plugin-checkin/server.js'; 

import globalSchema from './global.js'; 
import userSchema from '../clients/user.js';
import controlSchema from '../clients/control.js';

// - General documentation: https://soundworks.dev/
// - API documentation:     https://soundworks.dev/api
// - Issue Tracker:         https://github.com/collective-soundworks/soundworks/issues
// - Wizard & Tools:        `npx soundworks`

const config = loadConfig(process.env.ENV, import.meta.url);
//configureMaxClient(config);

console.log(`
--------------------------------------------------------
- launching "${config.app.name}" in "${process.env.ENV || 'default'}" environment
- [pid: ${process.pid}]
--------------------------------------------------------
`);

const server = new Server(config);
configureHttpRouter(server);

// Try to attach Cross-Origin-Opener-Policy / Cross-Origin-Embedder-Policy
// headers to the HTTP pipeline so the app can be cross-origin isolated.
// We attempt several common properties on the `server` object to be
// resilient to different versions of the soundworks helper.
try {
  const coopHeader = 'Cross-Origin-Opener-Policy';
  const coepHeader = 'Cross-Origin-Embedder-Policy';
  const coopValue = 'same-origin';
  const coepValue = 'require-corp';

  const attachHeadersToExpressApp = (app) => {
    try {
      app.use((req, res, next) => {
        res.setHeader(coopHeader, coopValue);
        res.setHeader(coepHeader, coepValue);
        next();
      });
      console.log('[server] COOP/COEP headers attached to express app');
      return true;
    } catch (err) {
      return false;
    }
  };

  let done = false;

  // common places where helpers might expose the express app
  if (!done && server.httpApp && typeof server.httpApp.use === 'function') {
    done = attachHeadersToExpressApp(server.httpApp);
  }
  if (!done && server.app && typeof server.app.use === 'function') {
    done = attachHeadersToExpressApp(server.app);
  }
  if (!done && server._httpApp && typeof server._httpApp.use === 'function') {
    done = attachHeadersToExpressApp(server._httpApp);
  }

  // Fallback: if an http server instance is available, attach a request
  // listener that sets the headers early on each response.
  if (!done && server.httpServer && server.httpServer.on) {
    server.httpServer.on('request', (req, res) => {
      try {
        res.setHeader(coopHeader, coopValue);
        res.setHeader(coepHeader, coepValue);
      } catch (e) { /* ignore */ }
    });
    done = true;
    console.log('[server] COOP/COEP headers attached to httpServer request event');
  }

  if (!done) {
    console.warn('[server] Could not automatically attach COOP/COEP headers. You may need to add middleware to your HTTP server to set these headers.');
  }
} catch (err) {
  console.warn('[server] Error while trying to attach COOP/COEP headers:', err);
}


// Register plugins and create shared state classes
server.pluginManager.register('platform-init', pluginPlatformInit); 
server.pluginManager.register('sync', pluginSync); 
server.pluginManager.register('checkin', pluginCheckin, {
  capacity: 20,
  data: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'o', 'p', 'q', 'r', 's', 't', 'u'],
}); 

server.stateManager.defineClass('global', globalSchema);
server.stateManager.defineClass('user', userSchema); 
server.stateManager.defineClass('control', controlSchema); 

await server.start();

const global = await server.stateManager.create('global');
//const user = await server.stateManager.create('user');  

const sync = await server.pluginManager.get('sync');
const syncTime = sync.getSyncTime();

global.onUpdate(updates => {
  if ('running' in updates) {
    const running = global.get('running');
    const triggerTime = syncTime + sync.getLocalTime();
    console.log(triggerTime);
    
    if (running) {
      global.set({syncTriggerTime: triggerTime});
      console.log(`Running state ON at syncTime ${triggerTime}`);
    }
  }
}, true)
