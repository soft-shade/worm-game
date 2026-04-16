var config = {
    type: Phaser.AUTO,
    parent: "game",
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT,
    dom: {createContainer: true},
    scene: [ Boot, Game, Intro ]
};

function startGame() { new Phaser.Game(config); }

if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(startGame);
} else {
    startGame();
}
