/**
 * Keep the browser tab alive when running in the background.
 *
 * Chrome's Tab Freezing policy suspends background tabs after ~5 minutes,
 * pausing all JavaScript execution. However, tabs playing audio are exempt.
 *
 * This utility plays a near-silent audio signal via AudioContext to prevent
 * the tab from being frozen. It must be started from a user interaction
 * (e.g. button click) to satisfy autoplay restrictions.
 */

let audioCtx: AudioContext | null = null;
let oscillator: OscillatorNode | null = null;
let gainNode: GainNode | null = null;

export function startKeepAwake(): void {
  if (audioCtx) return;

  try {
    audioCtx = new AudioContext();
    oscillator = audioCtx.createOscillator();
    gainNode = audioCtx.createGain();

    // Inaudible: 1 Hz at near-zero volume
    oscillator.frequency.value = 1;
    gainNode.gain.value = 0.001;

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    oscillator.start();
  } catch {
    // AudioContext not available — silently fail
    cleanup();
  }
}

export function stopKeepAwake(): void {
  cleanup();
}

function cleanup(): void {
  try {
    oscillator?.stop();
  } catch {
    // already stopped
  }
  try {
    audioCtx?.close();
  } catch {
    // already closed
  }
  oscillator = null;
  gainNode = null;
  audioCtx = null;
}
