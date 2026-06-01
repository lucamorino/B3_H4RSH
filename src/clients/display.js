import '@soundworks/helpers/polyfills.js';
import { Client } from '@soundworks/core/client.js';
import { loadConfig, launcher } from '@soundworks/helpers/browser.js';
import { html, render } from 'lit';

async function main($container) {
  const config = loadConfig();
  const client = new Client(config);

  launcher.register(client, {
    initScreensContainer: $container,
    reloadOnVisibilityChange: false,
  });

  await client.start();

  document.body.classList.add('display-client');

  const global = await client.stateManager.attach('global');

  const userCollection = await client.stateManager.getCollection('user');
  const userStates = new Map();
  const userUpdateUnsubs = new Map();

  const controlCollection = await client.stateManager.getCollection('control');
  const controlStates = new Map();
  const controlUpdateUnsubs = new Map();

  controlCollection.onAttach((state) => {
    controlStates.set(state.id, state);
    const off = state.onUpdate(() => renderApp());
    if (typeof off === 'function') controlUpdateUnsubs.set(state.id, off);
    renderApp();
  }, true);

  controlCollection.onDetach((state) => {
    controlStates.delete(state.id);
    const off = controlUpdateUnsubs.get(state.id);
    if (typeof off === 'function') off();
    controlUpdateUnsubs.delete(state.id);
    renderApp();
  });

  userCollection.onAttach((state) => {
    userStates.set(state.id, state);
    const off = state.onUpdate(() => renderApp());
    if (typeof off === 'function') userUpdateUnsubs.set(state.id, off);
    renderApp();
  }, true);

  userCollection.onDetach((state) => {
    userStates.delete(state.id);
    const off = userUpdateUnsubs.get(state.id);
    if (typeof off === 'function') off();
    userUpdateUnsubs.delete(state.id);
    renderApp();
  });

  global.onUpdate(() => renderApp());

  function sortedUserStates() {
    return Array.from(userStates.values()).sort((a, b) => (a.get('id') ?? 0) - (b.get('id') ?? 0));
  }

  function getControlByUserId(userId) {
    for (const cs of controlStates.values()) {
      if (Number(cs.get('id') ?? -1) === Number(userId)) return cs;
    }
    return null;
  }

  function renderApp() {
    const isRunning = global.get('running');
    const connectedUsers = sortedUserStates();
    const slots = Array.from({ length: 16 }, (_, i) => connectedUsers[i] || null);

    render(html`
      <div id="display-root">

        <div id="enter-overlay" style="display: ${isRunning ? 'none' : 'flex'}">
          <div style="font-size: 6vw; letter-spacing: 0.2em; color: white;">B3-H4RSH</div>
        </div>

        <div id="player-grid">
          ${slots.map((state, i) => {
            if (!state) {
              return html`<div class="player-cell empty"></div>`;
            }

            const userId = state.get('id') ?? i;
            const harsh = Number(state.get('harsh') ?? 0);
            const penalty = Number(state.get('penalty') ?? 0);
            const life = Number(state.get('life') ?? 10);
            const ctrl = getControlByUserId(userId);
            const active = ctrl ? Number(ctrl.get('active') ?? 0) > 0 : false;
            const lifePct = Math.max(0, Math.min(100, (life / 10) * 100));

            let bg, textColor;
            if (harsh > 0) {
              bg = '#ffffff';
              textColor = '#000000';
            } else if (penalty > 0) {
              bg = '#cc0000';
              textColor = '#ffffff';
            } else {
              bg = '#111111';
              textColor = '#f4f4f4';
            }

            return html`
              <div class="player-cell" style="background:${bg}; color:${textColor}">
                <div class="player-cell-id">P${userId}</div>
                <div class="player-cell-status">${active ? 'ACTIVE' : 'idle'}</div>
                <div class="player-cell-life">
                  <span class="player-life-symbol">♥</span>
                  <div class="player-life-bar">
                    <div class="player-life-fill" style="width:${lifePct}%"></div>
                  </div>
                  <span class="player-life-value">${life.toFixed(1)}</span>
                </div>
              </div>
            `;
          })}
        </div>

        <button
          id="fullscreen-btn"
          @click=${() => {
            if (!document.fullscreenElement) document.documentElement.requestFullscreen();
            else document.exitFullscreen();
          }}
        >${document.fullscreenElement ? '⛶ EXIT' : '⛶ FULLSCREEN'}</button>

      </div>
    `, $container);
  }

  renderApp();
}

launcher.execute(main, {
  numClients: parseInt(new URLSearchParams(window.location.search).get('emulate') || '') || 1,
  width: '100%',
});
