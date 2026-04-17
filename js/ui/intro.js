class Intro extends Phaser.Scene {

    constructor() {
	super('intro');
    }

    create() {
	const base_size = HISTORY_BOX_FONTSIZE;           // 24
	const worm_size = base_size * 1.2;                // 28.8
	const fade_ms = 500;

	const mk = (text, size) => {
	    const t = this.add.text(0, 0, text, {
		fontSize: size,
		fontFamily: "'Inter', sans-serif",
		color: COLOR_TEXT
	    }).setResolution(RESOLUTION).setOrigin(0, 0);
	    t.alpha = 0;
	    return t;
	};

	// Line spacing used by the actual game's word_history: a single-line
	// Phaser Text's rendered height equals the natural line advance for
	// that font size, so stacking lines at multiples of it matches how
	// "\n" would lay them out.
	const probe = this.add.text(0, 0, "> TEST", {
	    fontSize: base_size, fontFamily: "'Inter', sans-serif"
	}).setResolution(RESOLUTION);
	const line_h = probe.height;
	probe.destroy();

	// Four stacked words in the history column.
	const x_col = HISTORY_BOX_X;
	const y_col = HISTORY_BOX_Y;
	const sore  = mk("> SORE",  base_size); sore.setPosition(x_col, y_col + 0 * line_h);
	const swore = mk("> SWORE", base_size); swore.setPosition(x_col, y_col + 1 * line_h);
	const sword = mk("> SWORD", base_size); sword.setPosition(x_col, y_col + 2 * line_h);
	const word  = mk("> WORD",  base_size); word.setPosition(x_col, y_col + 3 * line_h);

	// Title row: "> WORM GAME" at 20% larger font, shifted down by the
	// regular line advance + 9 extra pixels, and horizontally centered
	// on the canvas (intentionally offset from the column above).
	const title_y = y_col + 4 * line_h + 9;
	const worm = mk("> WORM", worm_size);
	const game_label = mk("GAME", worm_size);

	// Measure the full title and the prefix so GAME lines up after
	// a single space at the title's font size.
	const full = this.add.text(0, 0, "> WORM GAME", {
	    fontSize: worm_size, fontFamily: "'Inter', sans-serif"
	}).setResolution(RESOLUTION);
	const full_w = full.width;
	full.destroy();
	const prefix = this.add.text(0, 0, "> WORM ", {
	    fontSize: worm_size, fontFamily: "'Inter', sans-serif"
	}).setResolution(RESOLUTION);
	const prefix_w = prefix.width;
	prefix.destroy();

	const title_x = (WINDOW_WIDTH - full_w) / 2;
	worm.setPosition(title_x, title_y);
	game_label.setPosition(title_x + prefix_w, title_y);

	// Fade-in schedule.
	const fade = (obj, delay_ms) => this.tweens.add({
	    targets: obj, alpha: 1,
	    delay: delay_ms, duration: fade_ms, ease: 'Sine.easeInOut'
	});
	fade(sore,       1000);
	fade(swore,      1500);
	fade(sword,      2000);
	fade(word,       2500);
	fade(worm,       3800);
	fade(game_label, 5100);

	// Interactive after GAME has been fully visible for 1s (t=5.6 + 1).
	this.ready = false;
	this.time.delayedCall(6600, () => { this.ready = true; });
	// Auto-advance 2.5s after the interactive window opens.
	const advance = () => {
	    if (this.advanced) return;
	    this.advanced = true;
	    this.scene.start('game');
	};
	this.time.delayedCall(9100, advance);
	this.input.on('pointerdown', () => { if (this.ready) advance(); });
    }

}
