let game = null;
let loading = false;

const intermission = document.querySelector('#intermission');
const beginButton = document.querySelector('#begin-level');

async function beginLevel() {
  if (game || loading) return;
  loading = true;
  beginButton.disabled = true;

  try {
    const [{ default: Phaser }, { default: WebScapeScene }] = await Promise.all([
      import('phaser'),
      import('./scene.js')
    ]);
    game = new Phaser.Game({
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
      scene: [WebScapeScene]
    });
    intermission.hidden = true;
  } catch (error) {
    loading = false;
    beginButton.disabled = false;
    throw error;
  }
}

beginButton.addEventListener('click', beginLevel);
document.addEventListener('keydown', event => {
  if (!intermission.hidden && event.code === 'Enter') {
    event.preventDefault();
    beginLevel();
  }
});