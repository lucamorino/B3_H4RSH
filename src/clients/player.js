import '@soundworks/helpers/polyfills.js';
import { Client } from '@soundworks/core/client.js';
import { loadConfig, launcher } from '@soundworks/helpers/browser.js';
import { html, render } from 'lit';
import '@ircam/sc-components';
//import devicemotion from '@ircam/devicemotion';

import "../lib/guardrails.js";

import { Scheduler } from '@ircam/sc-scheduling'; 
import loadAudioBuffer from '../lib/load-audio-buffer.js';
import LoopSampler from '../lib/LoopSampler.js';

import pluginPlatformInit from '@soundworks/plugin-platform-init/client.js'; 
import pluginSync from '@soundworks/plugin-sync/client.js'; 
import pluginCheckin from '@soundworks/plugin-checkin/client.js'; 
//import { start } from 'repl';
//import { send } from 'process';

//import FeedbackDelay from '../lib/FeedbackDelay.js';

// - General documentation: https://soundworks.dev/
// - API documentation:     https://soundworks.dev/api
// - Issue Tracker:         https://github.com/collective-soundworks/soundworks/issues
// - Wizard & Tools:        `npx soundworks`

/**
 * Attempts to request full-screen mode for the document.
 * Logs a warning if the API is not supported or if the request fails.
 */
function tryEnterFullscreen() {
  const element = document.documentElement; // Target the entire page
  let fullscreenPromise;

  if (element.requestFullscreen) {
    fullscreenPromise = element.requestFullscreen();
  } else if (element.mozRequestFullScreen) { // Firefox
    fullscreenPromise = element.mozRequestFullScreen();
  } else if (element.webkitRequestFullscreen) { // Chrome, Safari, Opera
    fullscreenPromise = element.webkitRequestFullscreen();
  } else if (element.msRequestFullscreen) { // IE/Edge
    fullscreenPromise = element.msRequestFullscreen();
  } else {
    console.warn('Fullscreen API is not supported by this browser.');
    // If not supported, return a resolved promise as there's nothing to do.
    return Promise.resolve();
  }

  return fullscreenPromise.catch(err => {
    console.warn(`Could not enter full-screen mode: ${err.message} (${err.name})`);
    // Re-throw the error so the promise chain reflects the failure.
    // This allows platform-init to know if fullscreen failed, if it needs to.
    throw err;
  });
}

let oscilloscopeStarted = false;
let backgroundRAF = null;
let backgroundState = { mode: 'idle', gain: 0, color: 'black' };
//let currentHarsh = 0;
//let currentPenalty = 0;

// Create the device
async function main($container) {
  
  const config = loadConfig();
  const client = new Client(config);
  const audioContext = new AudioContext();
  console.log(audioContext.sampleRate);
 
  client.pluginManager.register('checkin', pluginCheckin);
  client.pluginManager.register('platform-init', pluginPlatformInit, { 
    audioContext, //devicemotion
    /* onActivate: (plugin) => {
      // tryEnterFullscreen now returns a Promise
      return tryEnterFullscreen();
    } */
  }); 
  client.pluginManager.register('sync', pluginSync, {
    getTimeFunction: () => audioContext.currentTime, 
  }, ['platform-init']); 

  // cf. https://soundworks.dev/tools/helpers.html#browserlauncher
  launcher.register(client, { initScreensContainer: $container });

  await client.start();

  const platformInit = await client.pluginManager.get('platform-init');

  /* devicemotion.addEventListener(e => {
  console.log(e);
  e = { 
    interval // ms
    accelerationIncludingGravity = { x, y, z } // m/s2
    rotationRate = { alpha, beta, gamma } // deg/s
  }

}); */
  
  // Attempt to enter full-screen mode automatically after initial user gesture
  //tryEnterFullscreen();

  // retrieve initialized sync plugin 
  const sync = await client.pluginManager.get('sync'); 
  const scheduler = new Scheduler(() => sync.getSyncTime(), { 
    currentTimeToProcessorTimeFunction: syncTime => sync.getLocalTime(syncTime), 
  });

  const checkin = await client.pluginManager.get('checkin');
  const index = checkin.getIndex();
  //const instr = checkin.getData();
  const global = await client.stateManager.attach('global');
  const user = await client.stateManager.create('user');
  const control = await client.stateManager.create('control');

  user.set({id: index});
  control.set({id: index});

  // Create gain node and connect it to audio output
  const outputNode = audioContext.createGain();
  outputNode.connect(audioContext.destination);

  const analyser = audioContext.createAnalyser();
  analyser.fftSize = 1024;
  analyser.smoothingTimeConstant = 0.3;
  analyser.connect(outputNode)
  const baseColor = '#000000';

  const humGain = audioContext.createGain();
  humGain.gain.value = 0.5;
  humGain.connect(outputNode);


  const humSample = './assets/samples/hum.wav';
  const humBuffer = await loadAudioBuffer(humSample, audioContext.sampleRate);
  const volume = 0.75;
  const startTime = sync.getLocalTime() + 0.5; // 1 second in the future
  const isRunning = global.get('running');

  const humLoop = new LoopSampler(audioContext, humBuffer, volume, startTime);
  humLoop.output.connect(humGain);

  function playerLoop(startTime, isRunning) {
    if (!isRunning && !scheduler.has(humLoop.play)) {
        scheduler.add(humLoop.play, startTime);
        //console.log('adding scheduler');
      } else if (!isRunning && scheduler.has(humLoop.play)) {
        scheduler.remove(humLoop.play);
        humLoop.stop(startTime);
        scheduler.add(humLoop.play, startTime+0.5);
        //console.log('reset scheduler');
      } else if (isRunning && scheduler.has(humLoop.play)) { 
        scheduler.remove(humLoop.play);
        humLoop.stop(startTime);
      }
  };

  playerLoop(startTime, isRunning);


  const patchExportURL = "assets/rnbo_export/patch.export.json";
  let response, patcher;
  try {
      response = await fetch(patchExportURL);
      patcher = await response.json();
  
      if (!window.RNBO) {
          // Load RNBO script dynamically
          await loadRNBOScript(patcher.desc.meta.rnboversion);
      }
  } catch (err) {
      // Your existing error handling logic here...
      console.error("Failed to load patcher or RNBO script:", err);
      return;
  }

  let presets = patcher.presets || [];
  console.log(`Loaded patcher with ${presets.length} presets: `, presets.map(p => p.name));

  let device;
  console.log("Attempting to create RNBO device...");
  console.log("audioContext:", audioContext);
  console.log("patcher:", patcher);
  try {
      // RNBO is loaded into the window object, so we use RNBO.createDevice()
      // Also, the audio context variable is `audioContext`, not `context`
      device = await RNBO.createDevice({ context: audioContext, patcher });
  } catch (err) {
      // Your existing error handling logic here...
      console.error("Failed to create RNBO device:", err);
      return;
  }

  // Connect the device to the web audio graph
  device.node.connect(analyser);

  const inports = getInports(device);
  console.log("Inports:")
  console.log(inports);
  function stopBackground() {
    if (backgroundRAF) {
      cancelAnimationFrame(backgroundRAF);
      backgroundRAF = null;
    }
    backgroundState = { mode: 'idle', gain: 0, color: 'black' };
    document.body.style.background = baseColor;
    document.body.style.backgroundColor = baseColor;
  }

  function startBackgroundLoop() {
    if (backgroundRAF) return;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const render = () => {
      const { mode, gain, color } = backgroundState;
      let brightness = 0;

      if (gain > 0 && mode !== 'idle') {
        analyser.getByteTimeDomainData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += Math.abs(dataArray[i] - 128);
        }
        const amplitude = sum / bufferLength;
        brightness = Math.min(255, Math.floor((amplitude / 128) * 255 * gain));
        if (mode === 'penalty') brightness = Math.min(255, brightness + 30);
        if (mode === 'harsh') brightness = Math.max(20, brightness);
      }

      if (mode === 'penalty' && color === 'red') {
        const val = `rgba(255, ${brightness}, ${brightness}, 1)`;
        document.body.style.background = val;
        document.body.style.backgroundColor = val;
      } else if (mode === 'harsh') {
        const val = `rgb(${brightness}, ${brightness}, ${brightness})`;
        document.body.style.background = val;
        document.body.style.backgroundColor = val;
      } else {
        document.body.style.background = baseColor;
        document.body.style.backgroundColor = baseColor;
      }

      if (backgroundState.mode === 'idle') {
        stopBackground();
        return;
      }

      backgroundRAF = requestAnimationFrame(render);
    };

    backgroundRAF = requestAnimationFrame(render);
  }

  function applyBackgroundMode(harshness, penalty) {
    if (harshness > 0) {
      backgroundState = { mode: 'harsh', gain: 0.8, color: 'white' };
    } else if (penalty > 0) {
      backgroundState = { mode: 'penalty', gain: 0.4, color: 'red' };
    } else {
      backgroundState = { mode: 'idle', gain: 0, color: 'black' };
    }

    if (backgroundState.mode === 'idle') {
      stopBackground();
    } else {
      startBackgroundLoop();
    }
  }

  // initial goal message
  const goal = global.get('goal');
  console.log('Initial goal:', goal);
  sendMessageToInport(device, 'goal', goal);

  // initial preset load
  const initialPreset = user.get('preset') || 0;
  loadPresetAtIndex(device, presets, initialPreset);

  // Penalty counter state
  let penaltyCounter = 10.0;
  let penaltyInterval = null;
  let setGameoverOverlay = () => {};

  function updatePenaltyDisplay() {
    const el = document.getElementById('penalty-counter-value');
    const fill = document.getElementById('life-fill');
    const pct = Math.max(0, Math.min(100, (penaltyCounter / 10) * 100));
    if (el) el.textContent = penaltyCounter.toFixed(1);
    if (fill) fill.style.width = `${pct}%`;
  }

  /* function startPenaltyCounter() {
    if (penaltyInterval) return; // already running
    // ensure display shows current counter
    updatePenaltyDisplay();
    penaltyInterval = setInterval(() => {
      penaltyCounter = Math.max(0, +(penaltyCounter - 0.1).toFixed(1));
      updatePenaltyDisplay();
      if (penaltyCounter <= 0) {
        clearInterval(penaltyInterval);
        penaltyInterval = null;
        user.set({ life: false });
        console.log('you loose :(');
        sendMessageToInport(device, 'start', 0);
      }
    }, 200);
  }

  function stopPenaltyCounter(reset = true) {
    if (penaltyInterval) {
      clearInterval(penaltyInterval);
      penaltyInterval = null;
    }
    if (reset) {
      penaltyCounter = 10.0;
      updatePenaltyDisplay();
    }
  } */

  // Listen for messages from RNBO device
  device.messageEvent.subscribe((ev) => {
    if (ev.tag === "out5") {
      const zone = ev.payload;
      console.log(`Received message ${ev.tag}: ${ev.payload}`);
      user.set({zone: zone});// store in user state
    }
    if (ev.tag === "out4") {
      const style = ev.payload;
      console.log('Style received:', style);
      user.set({style: style});
      control.set({del: style[0]}); // trigger update
      control.set({phase: style[1]});
      control.set({bp: style[2]});
    }
    if (ev.tag === "out2") {
      const harshness = ev.payload; // first value in the message
      //const penalty = global.get('penalty');
      console.log(`Received message ${ev.tag}: ${harshness}`);
      applyBackgroundMode(harshness, 0);
      user.set({harsh: harshness});// store in user state
      /* if (harshness > 0) {
        const countPenalty = penalty + 1;
        console.log('Increasing penalty to', countPenalty);
        global.set({penalty: countPenalty});
        //applyBackgroundMode(harshness, countPenalty);
      } else if (harshness == 0 && penalty > 1) {
        const countPenalty = penalty - 1;
        global.set({penalty: countPenalty});
        //applyBackgroundMode(harshness, countPenalty);
      } else if (harshness == 0 && penalty <= 1) {
        const countPenalty = 0;
        global.set({penalty: countPenalty});
        //applyBackgroundMode(harshness, countPenalty);
      } */
    }
    if (ev.tag === "out3") {
      const lifePoints = ev.payload; // first value in the message
      penaltyCounter = lifePoints;
      updatePenaltyDisplay();
      if (lifePoints <= 0) {
        user.set({ life: lifePoints });
        console.log('you loose :(');
        sendMessageToInport(device, 'running', 0);
        setGameoverOverlay(true);
      }
    } 
  });

  global.onUpdate(updates => {
    if ('goal' in updates) {
      const newGoal = updates['goal'];
      console.log('Goal updated:', newGoal);
      sendMessageToInport(device, 'goal', newGoal);
    }
    if ('running' in updates) {
      const isRunning = updates['running'];
      const enterOverlay = document.getElementById("enter-overlay");
      const gameOverOverlay = document.getElementById('gameover-overlay');
      const startTime = sync.getLocalTime() + 0.5; // 1 second in the future

      if (isRunning) {
        user.set({ life: 10 });
        console.log('you live!');
        enterOverlay.style.display = "none";
        gameOverOverlay.style.display = "none";
      } else { 
        gameOverOverlay.style.display = "flex";
      }
      console.log('Running state updated:', isRunning);
      playerLoop(startTime, isRunning);
      sendMessageToInport(device, 'running', isRunning ? [1] : [0]);
    }
    if ('hrsh_threshold' in updates) {
      const param = getParameter(device, "hrsh_threshold");
      console.log('Updating hrsh_threshold to', updates['hrsh_threshold']);
      param.value = updates['hrsh_threshold'];
    }
  }); 

  user.onUpdate(updates => {
    if ('life' in updates) {
      const isAlive = updates['life'] > 0;
      setGameoverOverlay(!isAlive);
    }
    if ('proximity' in updates) {
      sendMessageToInport(device, 'proximity', updates['proximity']);
      //console.log('Updating proximity to', updates['proximity']);
    }
    if ('penalty' in updates) {
      const raw = updates['penalty'];
      const numeric = Array.isArray(raw) ? Number(raw[0]) : Number(raw);
      const penalty = Number.isFinite(numeric) && numeric > 0 ? 1 : 0;
      console.log('Updating penalty to', penalty);
      sendMessageToInport(device, 'penalty', [penalty]);
      applyBackgroundMode(0, penalty);
    }
    if ('preset' in updates) {
      const index = updates['preset'];
      loadPresetAtIndex(device, presets, index);
    }
  });

  // Trigger preset change on collision message from RNBO
  control.onUpdate(updates => {
    if ('collision' in updates && updates['collision'] === 1 && presets.length > 0) {
      const randIndex = Math.floor(Math.random() * presets.length);
      loadPresetAtIndex(device, presets, randIndex);
      user.set({ preset: randIndex });
    }
  });


  // -------------------------------------------------------------------
  // RENDER FUNCTION AND GRID SETUP
  // -------------------------------------------------------------------
  function renderApp() {
    render(html`
      <div id="app-root">

        <div id="enter-overlay">
            <div id="enter-content">
              <div id="enter-text"></div>
              <button id="enter-button" type="button"> >>> </button>
            </div>
        </div>

        <div id="gameover-overlay">
          <div id="gameover-content">G4M3 0V3R</div>
        </div>

        <div id="oscilloscope-container">
          <canvas id="oscilloscope" width="320" height="70"></canvas>
        </div>

        <div id="penalty-counter">
          <div class="life-label"> ♥ </div>
          <div class="life-bar">
            <div id="life-fill"></div>
          </div>
          <div class="life-value" id="penalty-counter-value">10.0</div>
        </div>

        <div id="xy-pad-container">
          <canvas id="xy-pad" width="320" height="320"></canvas>
        </div>

        <div id="xy-slider-container">
          <input id="xy-slider" type="range" min="0" max="100" value="50" />
        </div>

      </div>
    `, $container);
    }
    renderApp();
    //setupStartStop(device, audioContext);
    setGameoverOverlay = (visible) => {
      const overlay = document.getElementById('gameover-overlay');
      if (overlay) overlay.style.display = visible ? 'flex' : 'none';
    };
    setGameoverOverlay(false);
    setupUI(device, control);
    startOscilloscope(analyser);
  }

// load RNBO script dynamically
function loadRNBOScript(version) {
  return new Promise((resolve, reject) => {
    if (/^\d+\.\d+\.\d+-dev$/.test(version)) {
      throw new Error("Patcher exported with a Debug Version! Please specify the correct RNBO version to use in the code.");
    }

    // Try same-origin local copy first to avoid COEP/CORS issues.
    const localSrc = `assets/rnbo/${encodeURIComponent(version)}/rnbo.min.js`;
    const cdnSrc = `https://c74-public.nyc3.digitaloceanspaces.com/rnbo/${encodeURIComponent(version)}/rnbo.min.js`;

    function appendScript(src, useCrossOrigin) {
      const el = document.createElement('script');
      if (useCrossOrigin) {
        // when requesting cross-origin script, set crossorigin so proper CORS flow
        // can occur if the CDN returns Access-Control-Allow-Origin.
        el.crossOrigin = 'anonymous';
      }
      el.src = src;
      el.onload = () => resolve();
      el.onerror = (err) => {
        // If the local copy failed, try the CDN as a fallback. If CDN fails too, reject.
        if (src === localSrc) {
          console.warn(`Local RNBO not found at ${localSrc}, falling back to CDN`);
          // try CDN (may still be blocked by COEP if the CDN doesn't provide proper headers)
          appendScript(cdnSrc, true);
        } else {
          console.error(err);
          reject(new Error("Failed to load rnbo.js v" + version));
        }
      };
      document.body.append(el);
    }

    appendScript(localSrc, false);
  });
}
// helper functions
function getInports(device) {
  const messages = device.messages;
  const inports = messages.filter(
    (message) => message.type === RNBO.MessagePortType.Inport
  );
  return inports;
}
function getParameters(device) {
  const parameters = device.parameters;
  return parameters;
}
function getParameter(device, parameterName) {
  const parameters = device.parameters;
  const parameter = parameters.find((param) => param.name === parameterName);
  return parameter;
}
function sendMessageToInport(device, inportTag, values) {
  // Turn the text into a list of numbers (RNBO messages must be numbers, not text)
  //const messsageValues = values.split(/\s+/).map((s) => parseFloat(s));

  // Send the message event to the RNBO device
  let messageEvent = new RNBO.MessageEvent(
    RNBO.TimeNow,
    inportTag,
    values
  );
  device.scheduleEvent(messageEvent);
}
function loadPresetAtIndex(device, presets, index) {
    const presetIndex = Math.floor(Number(index));
    if (!Number.isFinite(presetIndex) || presetIndex < 0 || presetIndex >= presets.length) {
      console.warn('Ignoring invalid preset index:', index);
      return;
    }

    const preset = presets[presetIndex];
    if (!preset) {
      console.warn('Preset not found at index:', presetIndex);
      return;
    }

    console.log(`Loading preset ${preset.name}`);
    device.setPreset(preset.preset);
}

function startOscilloscope(analyser) {
  if (!analyser || oscilloscopeStarted) return;
  const canvas = document.getElementById('oscilloscope');
  if (!canvas) {
    // retry once the UI is rendered
    requestAnimationFrame(() => startOscilloscope(analyser));
    return;
  }
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  oscilloscopeStarted = true;

  // ensure consistent pixel size in case CSS resizes the canvas
  const width = canvas.width;
  const height = canvas.height;
  const bufferLength = analyser.fftSize;
  const dataArray = new Uint8Array(bufferLength);

  const draw = () => {
    analyser.getByteTimeDomainData(dataArray);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.fillRect(0, 0, width, height);

    // midline for reference
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, height / 2);
    ctx.lineTo(width, height / 2);
    ctx.stroke();

    ctx.lineWidth = 1;
    ctx.strokeStyle = '#f4f4f4';
    ctx.beginPath();

    const sliceWidth = width / bufferLength;
    let x = 0;

    for (let i = 0; i < bufferLength; i++) {
      const v = dataArray[i] / 128.0; // 128 is midline
      const y = (v * height) / 2;

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }

      x += sliceWidth;
    }

    ctx.stroke();
    requestAnimationFrame(draw);
  };

  draw();
}

function setupUI(device, control) {
    // Get all UI elements we need
    const canvas = document.getElementById('xy-pad');
    const ctx = canvas.getContext('2d');
    const slider = document.getElementById('xy-slider');
    const sliderValue = document.getElementById('xy-slider-value');
    const touchDebug = document.getElementById('touch-debug');
    //const waveButtons = document.querySelectorAll('.wave-btn');
    //const randomizeButton = document.getElementById('randomize-button');
    const accentColor = getComputedStyle(document.documentElement)
      .getPropertyValue('--sw-accent-color').trim() || '#ff44b4';

    const updateControlPosition = (x, y, z) => {
      if (control) control.set({ X: x, Y: y, Z: z });
    };

    // --- Multitouch: Use pointer events for pad and slider ---
    // Setup slider event handling
    if (slider) {
      slider.addEventListener('input', (e) => {
        const v = Number(e.target.value);
        if (sliderValue) sliderValue.textContent = String(v);

        // read latest pad coords (mapped values) from device._lastTouch
        const last = (device && device._lastTouch) ? device._lastTouch : Math.random()*100;//[86, 86];
        const touchX = last[0];
        const touchY = last[1];
        updateControlPosition(touchX, touchY, v);

        try {
          const msg = new RNBO.MessageEvent(RNBO.TimeNow, 'touch', [touchX, touchY, v]);
          if (touchDebug) touchDebug.textContent = `[${touchX}, ${touchY}, ${v}]`;
          device.scheduleEvent(msg);
        } catch (err) {
          console.debug('Could not schedule touch message with slider value', err);
        }
      });
    }

    // Setup pad
    let padSize = canvas.width;
    const dotRadius = 10;
    let dotX = padSize / 2;
    let dotY = padSize / 2;
    let dragging = false;
    let startActive = false;    

    // --- Pad: Use pointer events for multitouch ---
    // padSize, dotRadius, dotX, dotY, dragging now declared only once (see pointer events section below)
    let activePointerId = null;

    function resizePad() {
      const container = canvas.parentElement;
      const rect = container.getBoundingClientRect();
      const cs = getComputedStyle(container);
      const innerW = rect.width
        - parseFloat(cs.paddingLeft || '0')
        - parseFloat(cs.paddingRight || '0');
      const size = Math.max(150, Math.floor(innerW || window.innerWidth * 0.9));
      padSize = size;
      canvas.width = size;
      canvas.height = size;
      canvas.style.width = '100%';
      canvas.style.height = `${size}px`;
      dotX = Math.max(dotRadius, Math.min(padSize - dotRadius, dotX));
      dotY = Math.max(dotRadius, Math.min(padSize - dotRadius, dotY));
      drawPad();
    }

    function getXY(e) {
        let rect = canvas.getBoundingClientRect();
        let x, y;
        if (e.touches) {
            x = e.touches[0].clientX - rect.left;
            y = e.touches[0].clientY - rect.top;
        } else if (e.clientX !== undefined && e.clientY !== undefined) {
            x = e.clientX - rect.left;
            y = e.clientY - rect.top;
        } else if (e.pointerType && e.pointerType === 'touch') {
            x = e.clientX - rect.left;
            y = e.clientY - rect.top;
        }
        x = Math.max(dotRadius, Math.min(padSize - dotRadius, x));
        y = Math.max(dotRadius, Math.min(padSize - dotRadius, y));
        return { x, y };
    }

    function drawPad() {
        ctx.clearRect(0, 0, padSize, padSize);
        ctx.beginPath();
        ctx.arc(dotX, dotY, dotRadius, 0, 2 * Math.PI);
        ctx.fillStyle = accentColor || '#ff44b4';
        ctx.fill();
        ctx.strokeStyle = '#000';
        ctx.stroke();
    }

    resizePad();
    window.addEventListener('resize', resizePad);

    // Use pointer events for multitouch
    canvas.addEventListener('pointerdown', (e) => {
        if (activePointerId === null) {
            activePointerId = e.pointerId;
            dragging = true;
            let { x, y } = getXY(e);
            dotX = x;
            dotY = y;
            drawPad();
            let touchX = Math.round((dotX / padSize) * 100);
            let touchY = Math.round((dotY / padSize) * 100);
            device._lastTouch = [touchX, touchY];
            
            const sliderVal = Number(slider?.value || Math.random()*100);
            updateControlPosition(touchX, touchY, sliderVal);
            const messageEvent = new RNBO.MessageEvent(
                RNBO.TimeNow,
                "touch",
                [touchX, touchY, sliderVal]
            );
            if (touchDebug) touchDebug.textContent = `[${touchX}, ${touchY}, ${sliderVal}]`;
            device.scheduleEvent(messageEvent);
            //if (!startActive) {
              sendMessageToInport(device, 'randomize', [1]);
              sendMessageToInport(device, 'start', [1]);
              if (control) control.set({active: 1});
              //startActive = true;
        //}
      }
    });

    // Waveform buttons: toggle active/inactive styling
    /* if (waveButtons && waveButtons.length) {
      waveButtons.forEach((btn) => {
        btn.addEventListener('click', () => {
          btn.classList.toggle('active');
          btn.classList.toggle('inactive');
        });
      });
    } */

    canvas.addEventListener('pointermove', (e) => {
        if (dragging && e.pointerId === activePointerId) {
            let { x, y } = getXY(e);
            dotX = x;
            dotY = y;
            drawPad();
            let touchX = Math.round((dotX / padSize) * 100);
            let touchY = Math.round((dotY / padSize) * 100);
            device._lastTouch = [touchX, touchY];

            const sliderVal = Number(slider?.value || 50);
            updateControlPosition(touchX, touchY, sliderVal);
            
            const messageEvent = new RNBO.MessageEvent(
                RNBO.TimeNow,
                "touch",
                [touchX, touchY, sliderVal]
            );
            if (touchDebug) touchDebug.textContent = `[${touchX}, ${touchY}, ${sliderVal}]`;
            device.scheduleEvent(messageEvent);
        }
    });

    canvas.addEventListener('pointerup', (e) => {
        if (e.pointerId === activePointerId) {
            dragging = false;
            activePointerId = null;
            //if (startActive) {
              sendMessageToInport(device, 'start', [0]);
              user.set({ harsh: 0 });
              if (control) control.set({active: 0});
              //startActive = false;
          //}
        }
    });

    canvas.addEventListener('pointerleave', (e) => {
        if (e.pointerId === activePointerId) {
            dragging = false;
            activePointerId = null;
            //if (startActive) {
              sendMessageToInport(device, 'start', [0]);
              if (control) control.set({active: 0});
              //startActive = false;
        //}
      }
    });

    drawPad();

    /* if (randomizeButton) {
      randomizeButton.addEventListener('click', () => {
        try {
          const msg = new RNBO.MessageEvent(RNBO.TimeNow, 'randomize', [1]);
          device.scheduleEvent(msg);
          randomizeButton.classList.add('active');
          setTimeout(() => randomizeButton.classList.remove('active'), 120);
        } catch (err) {
          console.debug('Could not schedule randomize message', err);
        }
      });
    } */

    // Overlay text can be advanced as soon as UI is rendered (DOMContentLoaded may already have fired)
    const enterButton = document.getElementById("enter-button");
    const enterText = document.getElementById("enter-text");
    const enterTexts = [
      [
        'Welcome to B3-H4RSH!',
        'This a noise game, you have to harsh. ', 
        'The goal is to seek the harshest sound possible.',
        'Be careful: if another player harshes, you lose life points.',
        'Stay alive and be the last player still sounding to win.',
      ],
      [
        'Tap and hold the pad to generate the sound.',
        'Every time you tap, a new sound can come up.',
        'Drag around and move the slider to shape the noise',
        'Find the best point to harsh!',
      ],
      [
        'Turn up the volume on your device.',
        'Turn up the brightness of your screen.',
        'Wait for the game to start.',
        'Good luck and enjoy!',
      ],
    ];
    let enterTextIndex = 0;

    const renderEnterText = (index) => {
      if (!enterText) return;
      const lines = enterTexts[index] || [];
      const nodes = lines.map((line) => {
        const p = document.createElement('p');
        const em = document.createElement('em');
        em.textContent = line;
        p.appendChild(em);
        return p;
      });
      enterText.replaceChildren(...nodes);
      if (enterButton) {
        enterButton.style.display = index < enterTexts.length - 1 ? 'flex' : 'none';
      }
    };
    if (enterButton && enterText) {
      renderEnterText(enterTextIndex);
      const enterOverlay = document.getElementById('enter-overlay');
      enterButton.onclick = () => {
        //enterTextIndex = Math.min(enterTextIndex + 1, enterTexts.length - 1);
        //renderEnterText(enterTextIndex);
        enterOverlay.style.display = "none";
      };
    }
}

// The launcher allows to launch multiple clients in the same browser window
// e.g. `http://127.0.0.1:8000?emulate=10` to run 10 clients side-by-side
launcher.execute(main, {
  numClients: parseInt(new URLSearchParams(window.location.search).get('emulate') || '') || 1,
});
   
