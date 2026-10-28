// Keep tuning separate from game behaviour so features can be developed independently.
window.COIN_DASH = {
  width: 800,
  height: 500,
  roundSeconds: 45,
  playerSpeed: 240,
  // Each difficulty sets how fast drones move and how many coins win the round.
  difficulties: [
    { label: 'Easy', droneSpeed: 75, targetScore: 10 },
    { label: 'Medium', droneSpeed: 105, targetScore: 15 },
    { label: 'Hard', droneSpeed: 150, targetScore: 20 }
  ],
  droneCount: 3,
  colors: { background: 0x101c31, player: 0x71e8ce, coin: 0xffd166, drone: 0xff657a }
};
