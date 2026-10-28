/* global Phaser, COIN_DASH */
const HIGH_SCORE_KEY = 'coinDash.highScore';

// localStorage can be missing or throw (private mode, blocked storage), so fall back quietly.
function loadHighScore() {
  try {
    const value = parseInt(window.localStorage.getItem(HIGH_SCORE_KEY), 10);
    return Number.isFinite(value) && value > 0 ? value : 0;
  } catch (e) {
    return 0;
  }
}

function saveHighScore(value) {
  try {
    window.localStorage.setItem(HIGH_SCORE_KEY, String(value));
  } catch (e) { /* storage unavailable; the high score just won't persist */ }
}

class CoinDash extends Phaser.Scene {
  constructor() { super('CoinDash'); }

  create() {
    const c = COIN_DASH;
    this.score = 0;
    this.started = false;
    this.highScore = loadHighScore();
    this.newHighScore = false;
    this.finished = false;
    this.paused = false;
    this.physics.world.setBounds(0, 44, c.width, c.height - 44);
    this.add.grid(c.width / 2, c.height / 2, c.width, c.height, 40, 40,
      c.colors.background, 1, 0x24334b, 0.45);
    this.hud = this.add.text(18, 12, '', { font: '18px monospace', color: '#ffffff' });
    this.player = this.add.rectangle(c.width / 2, c.height / 2, 24, 24, c.colors.player);
    this.physics.add.existing(this.player);
    this.player.body.setCollideWorldBounds(true);
    this.coin = this.add.circle(100, 100, 9, c.colors.coin);
    this.physics.add.existing(this.coin);
    this.coin.body.setCircle(9);
    this.placeCoin();
    this.drones = this.physics.add.group();
    for (let i = 0; i < c.droneCount; i++) {
      const drone = this.add.rectangle(90 + i * 270, 100, 26, 26, c.colors.drone);
      this.drones.add(drone);
      drone.body.setCollideWorldBounds(true).setBounce(1, 1);
    }
    this.physics.add.overlap(this.player, this.coin, () => {
      if (this.finished) return;
      this.score++;
      if (this.score >= this.difficulty.targetScore) this.finish('Target reached!');
      else this.placeCoin();
      this.recordHighScore();
      this.placeCoin();
    });
    this.physics.add.overlap(this.player, this.drones, () => this.finish('A drone caught you!'));
    this.cursors = this.input.keyboard.createCursorKeys();
    // P and ESC are registered as keys so holding them does not auto-repeat the pause toggle.
    this.keys = this.input.keyboard.addKeys('W,A,S,D,R,P,ESC');
    this.input.keyboard.on('keydown-R', () => this.scene.restart());
    this.pauseOverlay = this.add.container(0, 0, [
      this.add.rectangle(c.width / 2, c.height / 2, 460, 150, 0x0a1120, 0.95),
      this.add.text(c.width / 2, c.height / 2 - 14, 'PAUSED',
        { font: '40px monospace', color: '#ffffff' }).setOrigin(0.5),
      this.add.text(c.width / 2, c.height / 2 + 36, 'Press P or ESC to resume',
        { font: '18px monospace', color: '#ffffff' }).setOrigin(0.5)
    ]).setVisible(false);
    this.input.keyboard.on('keydown-P', () => this.togglePause());
    this.input.keyboard.on('keydown-ESC', () => this.togglePause());
    this.createDifficultyMenu();
  }

  createDifficultyMenu() {
    const c = COIN_DASH;
    // Physics stays paused so the drones hold still until a difficulty is chosen.
    this.physics.pause();
    this.hud.setText('Choose a difficulty to start');
    const items = [
      this.add.rectangle(c.width / 2, c.height / 2, 560, 260, 0x0a1120, 0.95),
      this.add.text(c.width / 2, c.height / 2 - 92, 'Choose difficulty',
        { font: '28px monospace', color: '#ffffff' }).setOrigin(0.5),
      this.add.text(c.width / 2, c.height / 2 + 100, 'Click a level or press 1 / 2 / 3',
        { font: '16px monospace', color: '#ffffff' }).setOrigin(0.5)
    ];
    c.difficulties.forEach((difficulty, i) => {
      const x = c.width / 2 + (i - 1) * 170;
      const y = c.height / 2 + 6;
      const button = this.add.rectangle(x, y, 150, 110, 0x24334b)
        .setStrokeStyle(2, c.colors.player)
        .setInteractive({ useHandCursor: true })
        .on('pointerover', () => button.setFillStyle(0x34445e))
        .on('pointerout', () => button.setFillStyle(0x24334b))
        .on('pointerdown', () => this.startRound(difficulty));
      items.push(button,
        this.add.text(x, y - 24, `${i + 1}. ${difficulty.label}`,
          { font: '20px monospace', color: '#ffffff' }).setOrigin(0.5),
        this.add.text(x, y + 20, `Target: ${difficulty.targetScore}\nDrones: ${difficulty.droneSpeed}`,
          { font: '14px monospace', color: '#ffd166', align: 'center' }).setOrigin(0.5));
    });
    this.difficultyMenu = this.add.container(0, 0, items);
    ['ONE', 'TWO', 'THREE'].forEach((key, i) =>
      this.input.keyboard.on(`keydown-${key}`, () => this.startRound(c.difficulties[i])));
  }

  startRound(difficulty) {
    if (this.started) return;
    this.started = true;
    this.difficulty = difficulty;
    this.difficultyMenu.destroy();
    this.deadline = this.time.now + COIN_DASH.roundSeconds * 1000;
    this.drones.getChildren().forEach((drone, i) => {
      const angle = (35 + i * 105) * Math.PI / 180;
      drone.body.setVelocity(Math.cos(angle) * difficulty.droneSpeed,
        Math.sin(angle) * difficulty.droneSpeed);
    });
    this.physics.resume();
  }

  togglePause() {
    if (!this.started || this.finished) return;
    this.paused = !this.paused;
    this.pauseOverlay.setVisible(this.paused);
    if (this.paused) {
      this.pausedAt = this.time.now;
      this.physics.pause();
    } else {
      // Push the deadline back so time spent paused does not count against the round.
      this.deadline += this.time.now - this.pausedAt;
      this.physics.resume();
    }
  }

  placeCoin() {
    const c = COIN_DASH;
    // Avoid spawning the next coin directly underneath the player.
    let x, y;
    do {
      x = Phaser.Math.Between(25, c.width - 25);
      y = Phaser.Math.Between(70, c.height - 25);
    } while (Phaser.Math.Distance.Between(x, y, this.player.x, this.player.y) < 60);
    this.coin.setPosition(x, y);
    this.coin.body.reset(x, y);
  }

  // Save as soon as the record is beaten so a reload mid-round doesn't lose it.
  recordHighScore() {
    if (this.score <= this.highScore) return;
    this.highScore = this.score;
    this.newHighScore = true;
    saveHighScore(this.highScore);
  }

  update() {
    if (!this.started || this.finished || this.paused) return;
    const dx = Number(this.cursors.right.isDown || this.keys.D.isDown)
      - Number(this.cursors.left.isDown || this.keys.A.isDown);
    const dy = Number(this.cursors.down.isDown || this.keys.S.isDown)
      - Number(this.cursors.up.isDown || this.keys.W.isDown);
    const direction = new Phaser.Math.Vector2(dx, dy).normalize().scale(COIN_DASH.playerSpeed);
    this.player.body.setVelocity(direction.x, direction.y);
    const seconds = Math.max(0, Math.ceil((this.deadline - this.time.now) / 1000));
    const { label, targetScore } = this.difficulty;
    this.hud.setText(`Coins: ${this.score}/${targetScore}        ${label}        Time: ${seconds}s`);
    this.hud.setText(`Coins: ${this.score}   High Score: ${this.highScore}          Time: ${seconds}s`);
    if (seconds === 0) this.finish('Time is up!');
  }

  finish(reason) {
    if (this.finished) return;
    this.finished = true;
    this.physics.pause();
    const c = COIN_DASH;
    const best = this.newHighScore ? 'New high score!' : `High score: ${this.highScore}`;
    this.add.rectangle(c.width / 2, c.height / 2, 460, 190, 0x0a1120, 0.95);
    this.add.text(c.width / 2, c.height / 2,
      `${reason}\n${this.score}/${this.difficulty.targetScore} coins on ${this.difficulty.label}\nPress R to play again`,
      `${reason}\n${this.score} coins collected\n${best}\nPress R to try again`,
      { font: '24px monospace', color: '#ffffff', align: 'center', lineSpacing: 12 }
    ).setOrigin(0.5);
  }
}
window.coinDashGame = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: COIN_DASH.width,
  height: COIN_DASH.height,
  backgroundColor: COIN_DASH.colors.background,
  physics: { default: 'arcade', arcade: { debug: false } },
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_HORIZONTALLY },
  scene: CoinDash
});
