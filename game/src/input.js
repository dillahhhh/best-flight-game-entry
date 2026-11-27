// input.js — keyboard + mouse for Ember Strait. Keys are read per frame
// into a plain input object the flight model consumes; edge-triggered
// actions (camera, gear, pause, missions) are queued as events.

export function createInput() {
  const keys = new Set();
  const events = [];
  const input = {
    pitch: 0, roll: 0, throttle: 0, throttleSet: undefined,
    gear: undefined, flaps: undefined, brakes: false,
  };
  const KEYMAP = {
    ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
    KeyW: 'up', KeyS: 'down', KeyA: 'left', KeyD: 'right',
    ShiftLeft: 'thrUp', ShiftRight: 'thrUp', ControlLeft: 'thrDn', ControlRight: 'thrDn',
    KeyB: 'brakes', Space: 'brakes',
  };
  function onKey(e, down) {
    if (e.repeat) return;
    if (KEYMAP[e.code] || ['Enter', 'KeyC', 'KeyG', 'KeyF', 'KeyP', 'KeyR', 'KeyM', 'Escape'].includes(e.code)) {
      e.preventDefault();
    }
    if (down) keys.add(e.code); else keys.delete(e.code);
    if (!down) return;
    if (e.code === 'Enter') events.push({ type: 'start' });
    if (e.code === 'KeyC') events.push({ type: 'camera' });
    if (e.code === 'KeyG') events.push({ type: 'gear' });
    if (e.code === 'KeyF') events.push({ type: 'flaps' });
    if (e.code === 'KeyP' || e.code === 'Escape') events.push({ type: 'pause' });
    if (e.code === 'KeyR') events.push({ type: 'restart' });
    if (e.code === 'KeyM') events.push({ type: 'mute' });
    if (/^Digit[1-8]$/.test(e.code)) events.push({ type: 'mission', index: Number(e.code.slice(5)) - 1 });
  }
  window.addEventListener('keydown', (e) => onKey(e, true));
  window.addEventListener('keyup', (e) => onKey(e, false));
  window.addEventListener('blur', () => keys.clear());

  // Mouse: drag steers (pitch/roll), wheel is throttle.
  let dragging = false, mx = 0, my = 0;
  window.addEventListener('mousedown', (e) => { dragging = true; mx = e.clientX; my = e.clientY; });
  window.addEventListener('mouseup', () => { dragging = false; });
  window.addEventListener('mousemove', (e) => { if (dragging) { mx = e.clientX; my = e.clientY; } });
  window.addEventListener('wheel', (e) => {
    input.throttleSet = undefined;
    events.push({ type: 'wheel', delta: -Math.sign(e.deltaY) * 0.08 });
  }, { passive: true });

  function poll() {
    const up = keys.has('ArrowUp') || keys.has('KeyW');
    const dn = keys.has('ArrowDown') || keys.has('KeyS');
    const lf = keys.has('ArrowLeft') || keys.has('KeyA');
    const rt = keys.has('ArrowRight') || keys.has('KeyD');
    input.pitch = (up ? 1 : 0) - (dn ? 1 : 0);
    input.roll = (rt ? 1 : 0) - (lf ? 1 : 0);
    if (dragging) {
      input.pitch = Math.max(-1, Math.min(1, (window.innerHeight / 2 - my) / 220));
      input.roll = Math.max(-1, Math.min(1, (mx - window.innerWidth / 2) / 300));
    }
    input.throttle = ((keys.has('ShiftLeft') || keys.has('ShiftRight')) ? 1 : 0)
      - ((keys.has('ControlLeft') || keys.has('ControlRight')) ? 1 : 0);
    input.brakes = keys.has('KeyB') || keys.has('Space');
    const evs = events.splice(0, events.length);
    return { input, events: evs };
  }
  return { poll, keys };
}
