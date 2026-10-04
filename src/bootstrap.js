import Phaser from 'phaser';
import UpdraftScene from './scene.js';

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: 960,
  height: 600,
  backgroundColor: '#162326',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH
  },
  physics: {
    default: 'matter',
    matter: {
      gravity: { x: 0, y: 1, scale: 0.001 },
      debug: false,
      positionIterations: 8,
      velocityIterations: 6
    }
  },
  scene: [UpdraftScene]
});