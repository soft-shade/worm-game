class Intro extends Phaser.Scene {

    constructor() {
	super('intro');
    }

    create() {
	const base_size = HISTORY_BOX_FONTSIZE;           // 24
	const worm_size = base_size * 1.44;               // another 20% up from 1.2x
	const fade_small_ms = 120;                        // SORE..WORD
	const fade_big_ms = 240;                          // WORM, GAME, PLAY

	const mk = (text, size) => {
	    const t = this.add.text(0, 0, text, {
		fontSize: size,
		fontFamily: "'Inter', sans-serif",
		color: COLOR_TEXT
	    }).setResolution(RESOLUTION).setOrigin(0, 0);
	    t.alpha = 0;
	    return t;
	};

	// Line spacing used by the actual game's word_history.
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

	// Title row "> WORM GAME". The "> " prefix hangs off to the left so
	// that the words themselves (WORM GAME) are horizontally centered
	// on the canvas rather than the whole string.
	const title_y = y_col + 4 * line_h + 9 + 6;
	const worm = mk("> WORM", worm_size);
	const game_label = mk("GAME", worm_size);

	const measure = (s) => {
	    const t = this.add.text(0, 0, s, {
		fontSize: worm_size, fontFamily: "'Inter', sans-serif"
	    }).setResolution(RESOLUTION);
	    const w = t.width, h = t.height;
	    t.destroy();
	    return { w, h };
	};
	const arrow = measure("> ");
	const words = measure("WORM GAME");
	const worm_sp = measure("WORM ");
	const title_h = words.h;

	const words_x = (WINDOW_WIDTH - words.w) / 2;   // where WORM begins
	worm.setPosition(words_x - arrow.w, title_y);   // "> " sits to its left
	game_label.setPosition(words_x + worm_sp.w, title_y);

	// Play button below the title, styled like the DAILY PUZZLE button.
	const play_center_x = WINDOW_WIDTH / 2;
	const play_center_y = title_y + title_h + 55;
	const play = this.make_play_button(play_center_x, play_center_y);
	play.container.alpha = 0;
	play.zone.disableInteractive();

	// Fade-in schedule (ms). Words are 380ms apart, WORM/GAME use 600ms
	// gaps to the preceding word, and the play button appears 600ms
	// after GAME finishes.
	const fade = (target, delay_ms, duration) => this.tweens.add({
	    targets: target, alpha: 1,
	    delay: delay_ms, duration: duration, ease: 'Sine.easeInOut'
	});
	fade(sore,        500, fade_small_ms);
	fade(swore,       880, fade_small_ms);
	fade(sword,      1260, fade_small_ms);
	fade(word,       1640, fade_small_ms);        // done at 1760
	fade(worm,       2360, fade_big_ms);          // 0.6s after WORD finishes, done at 2600
	fade(game_label, 3200, fade_big_ms);          // 0.6s after WORM finishes, done at 3440
	this.tweens.add({
	    targets: play.container, alpha: 1,
	    delay: 4040, duration: fade_big_ms, ease: 'Sine.easeInOut',
	    onComplete: () => play.zone.setInteractive()
	});

	// Play click → 0.38s fade out to background, then start game.
	play.zone.on('pointerdown', () => {
	    if (this.advancing) return;
	    this.advancing = true;
	    play.zone.disableInteractive();
	    const bg = Phaser.Display.Color.HexStringToColor(COLOR_BG);
	    this.cameras.main.fadeOut(380, bg.red, bg.green, bg.blue);
	    this.cameras.main.once('camerafadeoutcomplete', () => {
		this.scene.start('game');
	    });
	});
    }

    // Styled like the DAILY PUZZLE button: green text, muted outline,
    // COLOR_BOX_FILL fill, drop shadow. Returns {container, text, zone}.
    // The container holds the shadow/fill/outline and text for easy
    // fade-in via container.alpha; zone is a separate interactive.
    make_play_button(cx, cy) {
	const fontsize = WORD_FONTSIZE;
	const pad_x = 22, pad_y = 12;
	const text_str = "PLAY";

	const probe = this.add.text(0, 0, text_str, {
	    fontSize: fontsize, fontFamily: "'Inter', sans-serif"
	}).setResolution(RESOLUTION);
	const tw = probe.width, th = probe.height;
	probe.destroy();

	const bw = tw + pad_x * 2, bh = th + pad_y * 2;
	const bx = cx - bw / 2, by = cy - bh / 2;
	const radius = 8;
	const muted = Phaser.Display.Color.HexStringToColor(COLOR_MUTED).color;
	const fill  = Phaser.Display.Color.HexStringToColor(COLOR_BOX_FILL).color;

	const box = this.add.graphics();
	const draw = (stroke_alpha) => {
	    box.clear();
	    box.fillStyle(0x000000, 0.35);
	    box.fillRoundedRect(bx + 2, by + 3, bw, bh, radius);
	    box.fillStyle(fill, 1);
	    box.fillRoundedRect(bx, by, bw, bh, radius);
	    box.lineStyle(1.5, muted, stroke_alpha);
	    box.strokeRoundedRect(bx, by, bw, bh, radius);
	};
	draw(0.5);

	const text = this.add.text(bx + pad_x, by + pad_y, text_str, {
	    fontSize: fontsize, fontFamily: "'Inter', sans-serif", color: COLOR_GREEN
	}).setResolution(RESOLUTION).setOrigin(0, 0);

	const container = this.add.container(0, 0);
	container.add([box, text]);

	const zone = this.add.zone(bx, by, bw, bh).setOrigin(0, 0).setInteractive();
	zone.on('pointerover', () => draw(0.95));
	zone.on('pointerout',  () => draw(0.5));

	return { container, text, box, zone };
    }

}
