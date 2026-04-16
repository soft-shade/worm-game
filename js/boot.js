class Boot extends Phaser.Scene {

    constructor () {
	super('boot');
    }
    
    
    init () {
	let element = document.createElement('style');
	document.head.appendChild(element);
    }
    
	// Preload assets from disk
	preload () {
		this.load.audio('worm_game_music', ['assets/worm-game.mp3']);
		this.load.plugin('rexshakepositionplugin', 'https://raw.githubusercontent.com/rexrainbow/phaser3-rex-notes/master/dist/rexshakepositionplugin.min.js', true);
		this.load.html("form", "html/form.html");
	    this.load.text('legal_words', 'assets/legal_words.txt');
	    this.load.text('word_graph', 'assets/word_graph_merged15.txt');
	}


    create () {
		let scene = this.scene;
		// Start the actual game!
		scene.start('game');
    }

}
