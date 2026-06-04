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
  document.documentElement.requestFullscreen().catch(() => {});

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

  function startPlaygroundLoop() {
    function draw() {
      const canvas = document.getElementById('playground-canvas');
      if (!canvas) {
        requestAnimationFrame(draw);
        return;
      }

      const rect = canvas.getBoundingClientRect();
      const w = Math.max(1, Math.round(rect.width));
      const h = Math.max(1, Math.round(rect.height));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }

      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, w, h);

      // Grid lines matching player.js xy-pad style
      const step = Math.round(w / 10);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.lineWidth = 1;
      for (let x = step; x < w; x += step) {
        ctx.beginPath();
        ctx.moveTo(x + 0.5, 0);
        ctx.lineTo(x + 0.5, h);
        ctx.stroke();
      }
      for (let y = step; y < h; y += step) {
        ctx.beginPath();
        ctx.moveTo(0, y + 0.5);
        ctx.lineTo(w, y + 0.5);
        ctx.stroke();
      }

      if (global.get('trial_mode')) {
        const goal = global.get('goal');
        if (Array.isArray(goal) && goal.length >= 2) {
          const [gx, gy] = goal;
          const gPixX = (Number(gx) / 100) * w;
          const gPixY = (Number(gy) / 100) * h;
          const s = (3 / 100) * Math.min(w, h);
          ctx.strokeStyle = 'rgba(244, 244, 244, 0.75)';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(gPixX - s / 2, gPixY - s / 2, s, s);
        }
      }

      for (const ctrl of controlStates.values()) {
        const userId = Number(ctrl.get('id') ?? -1);
        const ctrlX = Number(ctrl.get('X') ?? 50);
        const ctrlY = Number(ctrl.get('Y') ?? 50);
        const active = Number(ctrl.get('active') ?? 0) > 0;

        let userState = null;
        for (const us of userStates.values()) {
          if (Number(us.get('id') ?? -1) === userId) { userState = us; break; }
        }

        const harsh = userState ? Number(userState.get('harsh') ?? 0) : 0;
        const penalty = userState ? Number(userState.get('penalty') ?? 0) : 0;

        let fillColor;
        if (harsh > 0) fillColor = '#ffffff';
        else if (penalty > 0) fillColor = '#cc2200';
        else if (active) fillColor = '#f4f4f4';
        else fillColor = 'rgba(244, 244, 244, 0.3)';

        const px = (ctrlX / 100) * w;
        const py = (ctrlY / 100) * h;
        const r = Math.max(6, Math.round(w * 0.025));

        ctx.beginPath();
        ctx.arc(px, py, r, 0, 2 * Math.PI);
        ctx.fillStyle = fillColor;
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.6)';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        const fontSize = Math.max(7, r - 2);
        ctx.fillStyle = harsh > 0 ? '#111111' : 'rgba(0,0,0,0.85)';
        ctx.font = `bold ${fontSize}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(userId), px, py);
      }

      requestAnimationFrame(draw);
    }
    requestAnimationFrame(draw);
  }

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

        <div id="display-left">
          <div id="player-grid">
            ${slots.map((state, i) => {
              if (!state) {
                return html`<div class="player-cell empty"></div>`;
              }

              const userId = state.get('id') ?? i;
              const harsh = Number(state.get('harsh') ?? 0);
              const penalty = Number(state.get('penalty') ?? 0);
              const life = Number(state.get('life') ?? 10);
              const preset = Number(state.get('preset') ?? 0);
              const ctrl = getControlByUserId(userId);
              const active = ctrl ? Number(ctrl.get('active') ?? 0) > 0 : false;
              const sharpness = ctrl ? Number(ctrl.get('sharpness') ?? 0) : 0;
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
                  ${life <= 0 ? html`<div class="player-cell-gameover">G4M3 0V3R</div>` : ''}
                  <div class="player-cell-header">P${userId}</div>
                  <div class="player-cell-body">
                    <div class="player-param-row">
                      <span class="player-param-label">STATUS</span>
                      <span class="player-param-value">${active ? 'ON' : 'OFF'}</span>
                    </div>
                    <div class="player-param-row">
                      <span class="player-param-label">SHARP</span>
                      <span class="player-param-value">${sharpness.toFixed(2)}</span>
                    </div>
                    <div class="player-param-row">
                      <span class="player-param-label">PRESET</span>
                      <span class="player-param-value">${preset}</span>
                    </div>
                    <div class="player-cell-life">
                      <span class="player-life-symbol">♥</span>
                      <div class="player-life-bar">
                        <div class="player-life-fill" style="width:${lifePct}%"></div>
                      </div>
                      <span class="player-life-value">${life.toFixed(1)}</span>
                    </div>
                  </div>
                </div>
              `;
            })}
          </div>

          <canvas id="playground-canvas"></canvas>
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
  startPlaygroundLoop();
}

launcher.execute(main, {
  numClients: parseInt(new URLSearchParams(window.location.search).get('emulate') || '') || 1,
  width: '100%',
});
