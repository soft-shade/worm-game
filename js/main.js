var config = {
    type: Phaser.AUTO,
    parent: "game",
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT,
    dom: {createContainer: true},
    scene: [ Boot, Game, Intro ]
};

function startGame() { new Phaser.Game(config); }

if (document.fonts && document.fonts.load) {
    Promise.all([
        document.fonts.load("24px 'JetBrains Mono'"),
        document.fonts.load("bold 24px 'JetBrains Mono'")
    ]).then(startGame).catch(startGame);
} else {
    startGame();
}
