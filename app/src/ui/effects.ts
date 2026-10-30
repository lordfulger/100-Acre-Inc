// The map's little touches (weather, fireflies, birds, smoke, extra wanderers) can lag
// on older phones. With the setting on "auto", the game watches how smoothly this
// phone draws for a few seconds after it starts, and turns them down if it struggles.
import { Platform } from 'react-native';

export type EffectsSetting = 'auto' | 'full' | 'light';

let slow = false;

function measure() {
  if (Platform.OS !== 'web' || typeof window === 'undefined' || !window.requestAnimationFrame) return;
  // A hidden page draws nothing, which would look slow: wait until it's on screen.
  if (document.visibilityState !== 'visible') { setTimeout(measure, 5_000); return; }
  let frames = 0;
  const start = performance.now();
  const count = () => {
    if (document.visibilityState !== 'visible') { setTimeout(measure, 5_000); return; }
    frames++;
    if (performance.now() - start < 3_000) requestAnimationFrame(count);
    else slow = frames / 3 < 28; // well under the 30 a phone in battery-saver mode manages
  };
  requestAnimationFrame(count);
}
// Measured once the map and its animations are up and running.
if (Platform.OS === 'web') setTimeout(measure, 4_000);

/** True when the light version should be used: chosen in settings, or picked automatically. */
export const lightEffects = (setting: EffectsSetting | undefined) => setting === 'light' || (setting !== 'full' && slow);
/** Whether "auto" found this phone slow (for the settings hint). */
export const seemsSlow = () => slow;
