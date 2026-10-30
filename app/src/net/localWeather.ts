// The player's real weather, for players who turn it on (Nap tab). The phone finds
// roughly where it is (rounded to about 10 km) and asks Open-Meteo, a free weather
// service, what it's like there. The location goes only to Open-Meteo: never to the
// game's server, and it isn't saved. Weather is only for looks; nothing depends on it.
import * as Location from 'expo-location';
import { setLiveWeather, weatherFromCode } from '../game/calendar';

/** How long a reading is used before it's too old to trust (refreshes come every 30 minutes). */
const FRESH_MS = 2 * 3_600_000;
export type LocalWeatherResult = 'ok' | 'denied' | 'failed';

/**
 * Looks up the weather outside and shows it in the wood. `ask` lets it ask for
 * permission to use the location (only when the player turns this on); otherwise
 * it quietly uses permission already given.
 */
export async function refreshLocalWeather(ask: boolean): Promise<LocalWeatherResult> {
  try {
    const perm = ask ? await Location.requestForegroundPermissionsAsync() : await Location.getForegroundPermissionsAsync();
    // A clear no stops here. "Not asked yet" (browsers often say so even after a yes) goes
    // on: the browser asks again if it needs to.
    if (!perm.granted && (ask || perm.status === 'denied')) return 'denied';
    // A recent fix is plenty for weather (and quicker); not every phone or browser keeps one.
    const recent = await Location.getLastKnownPositionAsync({ maxAge: 3_600_000 }).catch(() => null);
    const pos = recent ?? (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Lowest }));
    const lat = pos.coords.latitude.toFixed(1);
    const lon = pos.coords.longitude.toFixed(1);
    const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=weather_code,wind_speed_10m`);
    if (!res.ok) return 'failed';
    const data = await res.json();
    const code = Number(data?.current?.weather_code);
    if (!Number.isFinite(code)) return 'failed';
    setLiveWeather({ weather: weatherFromCode(code, Number(data.current.wind_speed_10m) || 0), until: Date.now() + FRESH_MS });
    return 'ok';
  } catch {
    return 'failed';
  }
}

/** Back to the wood's own weather. */
export const stopLocalWeather = () => setLiveWeather(null);
