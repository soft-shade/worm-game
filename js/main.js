var config = {
    type: Phaser.AUTO,
    parent: "game",
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT,
    backgroundColor: "#1e1e2e",
    dom: {createContainer: true},
    scene: [ Boot, Game, Intro ]
};

function startGame() { new Phaser.Game(config); }

if (document.fonts && document.fonts.load) {
    Promise.all([
        document.fonts.load("24px 'Inter'"),
        document.fonts.load("600 24px 'Inter'")
    ]).then(startGame).catch(startGame);
} else {
    startGame();
}
