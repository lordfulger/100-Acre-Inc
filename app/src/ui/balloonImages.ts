// The balloons that drift up the screen: one of each colour, and now and then a
// whole bunch. Hand-drawn art in assets/art/balloons.
export const BALLOON_COLOURS = {
  red: require('../../assets/art/balloons/red.png'),
  orange: require('../../assets/art/balloons/orange.png'),
  yellow: require('../../assets/art/balloons/yellow.png'),
  green: require('../../assets/art/balloons/green.png'),
  blue: require('../../assets/art/balloons/blue.png'),
  purple: require('../../assets/art/balloons/purple.png'),
  pink: require('../../assets/art/balloons/pink.png'),
};
export type BalloonColour = keyof typeof BALLOON_COLOURS;
export const BALLOON_BUNCH = require('../../assets/art/balloons/bunch.png');

const COLOURS = Object.keys(BALLOON_COLOURS) as BalloonColour[];
/** A balloon of any colour except those listed. */
export const anyColour = (except: BalloonColour[] = []) => {
  const pick = COLOURS.filter((c) => !except.includes(c));
  return pick[Math.floor(Math.random() * pick.length)];
};
