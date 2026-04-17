class Game extends Phaser.Scene {

    constructor() {
	super('game');

	this.word_array;
	this.word_graph;
	this.start_words_array;

	this.start_word;
	this.current_word;
	this.prev_word;
	this.goal_word;
	this.word_path;
	this.score_counter;
	this.word_history;
	
	this.input_box;
	this.shake_input;
	this.enter_key;
	
	this.count;
	this.VICTORY;
	this.complaint_counter;
	this.freeplay_stage;
	
	this.rules_button;
	this.rules_modal;
	this.reset;
	this.restart;
	this.solved;

	this.daily_challenge;
	this.free_play;
	this.regular;
	
	this.tween_notinenglish
    }

    create() {
	//------ Load game elements -----//
	this.load_text();
	this.load_dictionary();
	this.load_daily();
	this.load_complaints();
	this.load_interactive();

	//------ Misc loading -----------//
	// Add shake behavior
	this.shake_input = this.plugins.get('rexshakepositionplugin').add(this.input_box, {
	    duration: 100,
	    magnitude: 15
	});

	// Add enter key press listener
	this.enter_key = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
	this.enter_key.on('down', this.handle_press_enter, this);

	//this.generate_puzzle();
	this.start_word = this.daily_start;
	this.goal_word.setText(this.daily_goal);
	this.word_path = calc_word_path(this.start_word,this.goal_word.text,this.word_array,this.word_graph)
	this.reset_game_state();
    }

    // Pick today's daily puzzle pair out of assets/daily_list.txt.
    // Falls back to DAILY_START_WORD / DAILY_GOAL_WORD if today's date
    // isn't in the list (e.g. before the list starts or after it ends).
    load_daily() {
	const raw = this.cache.text.get('daily_list') || '';
	const today = new Date();
	const dd = String(today.getDate()).padStart(2, '0');
	const mm = String(today.getMonth() + 1).padStart(2, '0');
	const yyyy = today.getFullYear();
	const today_str = `${dd}-${mm}-${yyyy}`;

	let start = DAILY_START_WORD;
	let goal = DAILY_GOAL_WORD;
	for (const line of raw.replaceAll('\r', '').split('\n')) {
	    const trimmed = line.trim();
	    if (!trimmed) continue;
	    const parts = trimmed.split(',');
	    if (parts.length >= 3 && parts[0] === today_str) {
		start = parts[1].toUpperCase();
		goal = parts[2].toUpperCase();
		break;
	    }
	}
	this.daily_start = start;
	this.daily_goal = goal;
    }

    // Add a text element with some default settings
    add_text(x, y, text_str, fontsize, color = COLOR_TEXT) {
	let new_text = this.add.text(x, y, text_str,
				     { fontSize: fontsize, fontFamily: "'Inter', sans-serif", color: color}).setResolution(RESOLUTION);
	new_text.setOrigin(0.5,0.5);
	return new_text;
    }

    // Text with a rounded-rect bubble (fill + outline + drop shadow) and
    // a hover highlight. Returns { text, box, zone }. Use
    // zone.on('pointerdown', ...) for clicks.
    add_button(x, y, text_str, fontsize, text_color, origin_x, origin_y, padding_x, padding_y) {
	// Measure text first with a throwaway render so we can size the box.
	const probe = this.add.text(0, 0, text_str,
				    { fontSize: fontsize, fontFamily: "'Inter', sans-serif" })
	      .setResolution(RESOLUTION);
	const tw = probe.width, th = probe.height;
	probe.destroy();

	const tx = x - tw * origin_x;
	const ty = y - th * origin_y;
	const bx = tx - padding_x, by = ty - padding_y;
	const bw = tw + padding_x * 2, bh = th + padding_y * 2;

	const muted = Phaser.Display.Color.HexStringToColor(COLOR_MUTED).color;
	const fill = Phaser.Display.Color.HexStringToColor(COLOR_BOX_FILL).color;
	const radius = 8;

	// Draw the box first so subsequently-added text renders on top.
	const box = this.add.graphics();
	const draw = (stroke_alpha) => {
	    box.clear();
	    // Drop shadow, offset down+right.
	    box.fillStyle(0x000000, 0.35);
	    box.fillRoundedRect(bx + 2, by + 3, bw, bh, radius);
	    // Fill (slightly lighter than page background for a subtle lift).
	    box.fillStyle(fill, 1);
	    box.fillRoundedRect(bx, by, bw, bh, radius);
	    // Outline.
	    box.lineStyle(1.5, muted, stroke_alpha);
	    box.strokeRoundedRect(bx, by, bw, bh, radius);
	};
	draw(0.5);

	const text = this.add.text(tx, ty, text_str,
				   { fontSize: fontsize, fontFamily: "'Inter', sans-serif", color: text_color })
	    .setResolution(RESOLUTION)
	    .setOrigin(0, 0);

	const zone = this.add.zone(bx, by, bw, bh).setOrigin(0, 0).setInteractive();
	zone.on('pointerover', () => draw(0.95));
	zone.on('pointerout', () => draw(0.5));
	return { text, box, zone };
    }

    // Update which mode button is highlighted
    set_active_mode(mode) {
	this.regular.text.setColor(mode === 'practice' ? COLOR_GREEN : COLOR_RED);
	this.daily_challenge.text.setColor(mode === 'daily' ? COLOR_GREEN : COLOR_RED);
	this.free_play.text.setColor(mode === 'freeplay' ? COLOR_GREEN : COLOR_RED);
    }

    // Reset game variables
    reset_game_state() {
	this.error_msg.setText("");
	this.count = 0;
	this.VICTORY = false;
	this.complaint_counter = 0;
	this.freeplay_stage = FREEPLAY_STAGES["none"];
	this.score_counter.setText("0");
	this.current_word = this.start_word.toUpperCase();
	this.prev_word.setText(this.start_word.toUpperCase());
	this.word_history.setText("> "+this.start_word.toUpperCase());
    }
    
    // Generate new puzzle
    generate_puzzle() {
	this.start_word = get_start_word(this.start_words_array);
	let new_path = [];
	new_path = generate_random_word_path(this.start_word,MIN_PATH_LENGTH,MAX_PATH_LENGTH,this.word_array,this.word_graph);
	while (new_path.length < MIN_PATH_LENGTH) {
	    new_path = generate_random_word_path(this.start_word,MIN_PATH_LENGTH,MAX_PATH_LENGTH,this.word_array,this.word_graph);
	    if (new_path.length == 0)
		this.start_word = get_start_word(this.start_words_array);
	}
	this.start_word = new_path[0]; //New start word
	this.goal_word.setText(new_path[new_path.length-1].toUpperCase()); //New end word
	this.word_path = new_path;
	console.log(`Solution: ${new_path}`);
    }
    show_solution() {
	//console.log(this.word_path)
	this.word_history.setText("");
	this.word_history.setOrigin(0,0);
	for (let i = 0; i < this.word_path.length; i++) {
	    this.word_history.text = this.word_history.text + "\n> " + this.word_path[i].toUpperCase();
	    if (this.word_history.displayHeight > HISTORY_BOX_H)
		this.word_history.y = HISTORY_BOX_Y + HISTORY_BOX_H - this.word_history.displayHeight;
	}
	this.error_msg.setText(`One ideal solution was ${this.word_path.length-1} steps.`);
	
    }
    // Display the error message with some default settings
    display_error_message(error_str) {
	this.shake_input.shake();
	// Capture the underlying (non-error) message only on the first
	// error in a sequence, and cancel any pending restore so chained
	// errors always get a fresh 2-second window. Without this, a
	// second error fires its own restore later and re-displays the
	// earlier error.
	if (this.timedEvent) {
	    this.timedEvent.remove();
	    this.timedEvent = null;
	} else {
	    this.error_base_msg = this.error_msg.text;
	}
	this.error_msg.setText(error_str);
	this.timedEvent = this.time.delayedCall(2000, function () {
	    this.error_msg.setText(this.error_base_msg || "");
	    this.timedEvent = null;
	}, [], this);
    }

    // Do some stuff when enter is pressed on the input box
    handle_press_enter() {
	let input_word = this.input_box.getChildByName("input_word").value.toUpperCase();
        this.input_box.getChildByName("input_word").value = "";
	if (input_word === "") return;
	if (!this.check_word_in_dictionary(input_word)){
	    this.display_error_message(`${input_word} is not a valid word!`);
	    return;
	}

	// Entering the first word for freeplay mode
	if (this.freeplay_stage == FREEPLAY_STAGES["first_word"]) {
	    this.start_word = input_word;
	    this.current_word = input_word;
	    this.prev_word.setText(this.start_word);
	    this.word_history.setText("> "+this.start_word);
	    this.freeplay_stage = FREEPLAY_STAGES["second_word"];
	    this.error_msg.setText("Enter goal word.");

	    // Entering the second word for freeplay mode
	} else if (this.freeplay_stage == FREEPLAY_STAGES["second_word"]) {
	    if (input_word == this.start_word) {
		this.shake_input.shake();
		this.error_msg.setText("Goal word cannot be starting word, try again.");
		return;
	    }
	    let word_path = calc_word_path(this.start_word,input_word,this.word_array,this.word_graph);
	    //console.log(word_path)
	    if (word_path.length == 0) { // If no valid path between given words
		this.error_msg.setText("No possible path to this word, try again.");
	    } else {
		this.word_path = word_path;
		this.goal_word.setText(input_word);
		this.freeplay_stage = FREEPLAY_STAGES["none"];
		this.error_msg.setText("");
	    }

	    // Victory!
	} else if (this.VICTORY) {
	    this.shake_input.shake();
	    if (this.complaint_counter < this.complaints_array.length) {
		let complain_string = this.complaints_array.at(this.complaint_counter);
		this.score_counter.setText(complain_string);
	    } else {
		let complain_string = `YOU WON IN ${this.count}, PLAY AGAIN`;
		this.score_counter.setText(complain_string);
	    }
	    this.complaint_counter++;

	    // Normal play
	} else {
	    if (!this.check_word_off_by_one(input_word)) {
		this.display_error_message(`${input_word} is not off by one letter!`);
		return;
	    }
	    this.word_history.text = this.word_history.text + "\n> " + input_word;
	    this.current_word = input_word;
	    if (!this.check_victory(input_word)) {
		this.score_counter.setText(++this.count);
		if (this.word_history.displayHeight > HISTORY_BOX_H)
		    this.word_history.y = HISTORY_BOX_Y + HISTORY_BOX_H - this.word_history.displayHeight;
	    } else {
		let word_path = calc_word_path(this.start_word,input_word,this.word_array,this.word_graph)

		this.error_msg.setText(`The shortest possible path is ${word_path.length-1} steps.`);
		this.score_counter.setText(`WIN IN ${++this.count}!`);
		this.VICTORY = true;
	    }
	}
    }

    // Check if the word is off by one letter from prev word
    check_word_off_by_one(input_word) {
	let prev_word = this.current_word;
	// Basic checks before the letter loop
	if(input_word.length == 0 || 
	   input_word === prev_word || 
	   Math.abs(input_word.length - prev_word.length)>=2 ) {
	    return false;
	}

	// Loop through each letter of input word
	for (let i = 0; i < input_word.length; i++) {
	    // Break if input word equals the prev word plus one letter at the end
	    if (i >= prev_word.length)
		break;
	    // Once a discrepancy is found, check if the remaining parts of the words are identical
	    if (input_word[i] !== prev_word[i]) {
		if (input_word.length == prev_word.length)
		    return input_word.substring(i+1) === prev_word.substring(i+1);
		else if (input_word.length < prev_word.length)
		    return input_word.substring(i) === prev_word.substring(i+1);
		else if (input_word.length > prev_word.length)
		    return input_word.substring(i+1) === prev_word.substring(i);
	    }
	}
	return true;
    }
    
    // Check if the word is in the dictionary
    check_word_in_dictionary(input_word) {
	if(this.word_array.includes(input_word.toLowerCase()) ) {
	    return true;
	}
    }

    // Check if the victory condition has been met
    check_victory(input_word) {
	let goal_word = this.goal_word.text;
	if(input_word == goal_word) {
	    return true
	}
    }

    // Load text objects
    load_text() {
	this.prev_word = this.add_text(PREV_WORD_X,PREV_WORD_Y,"START",WORD_FONTSIZE);
	this.goal_word = this.add_text(GOAL_WORD_X,GOAL_WORD_Y,"END",WORD_FONTSIZE);
	this.score_counter = this.add_text(SCORE_X,SCORE_Y,"0",WORD_FONTSIZE);
	this.word_history = this.add_text(HISTORY_BOX_X,HISTORY_BOX_Y,"> "+this.prev_word.text,HISTORY_BOX_FONTSIZE);
	this.word_history.setOrigin(0,0);
	this.error_msg = this.add_text(ERROR_BOX_X,ERROR_BOX_Y,"",HISTORY_BOX_FONTSIZE);
    }

    // Load interactive elements (buttons, input box, scroll panel)
    load_interactive() {
	// Add input box
	this.input_box = this.add.dom(INPUT_BOX_X, INPUT_BOX_Y).createFromCache("form");
	this.input_box.setOrigin(0.5,0.5);

	// Restrict the text field to basic English letters: block typing of
	// non-[a-zA-Z], block paste / drag-drop, and strip anything that
	// still slips through (composition events, IME, etc.).
	const inp = this.input_box.getChildByName("input_word");
	inp.addEventListener('beforeinput', function (e) {
	    if (e.inputType === 'insertFromPaste' || e.inputType === 'insertFromDrop') {
		e.preventDefault();
		return;
	    }
	    if (e.data && !/^[a-zA-Z]+$/.test(e.data)) {
		e.preventDefault();
	    }
	});
	inp.addEventListener('input', function (e) {
	    const cleaned = e.target.value.replace(/[^a-zA-Z]/g, '');
	    if (cleaned !== e.target.value) e.target.value = cleaned;
	});
	
	// Add scroll panel for word_history
	var graphics = this.make.graphics();
	graphics.fillRect(HISTORY_BOX_X, HISTORY_BOX_Y, HISTORY_BOX_W, HISTORY_BOX_H);
	var history_mask = new Phaser.Display.Masks.GeometryMask(this, graphics);
	this.word_history.setMask(history_mask);
	var history_zone = this.add.zone(HISTORY_BOX_X, HISTORY_BOX_Y, HISTORY_BOX_W, HISTORY_BOX_H).setOrigin(0).setInteractive();	
	history_zone.on('wheel', function (pointer) {
	    if (this.word_history.displayHeight > HISTORY_BOX_H) {
		this.word_history.y -= (pointer.deltaY / 5);
		this.word_history.y = Phaser.Math.Clamp(this.word_history.y, 
							HISTORY_BOX_Y + HISTORY_BOX_H - this.word_history.displayHeight, HISTORY_BOX_Y);
	    }
	}, this);

	// Small action buttons along the bottom corners
	const APX = 12, APY = 6;

	this.reset = this.add_button(RESET_X, RESET_Y, "RESET", ACTION_FONTSIZE, COLOR_RED, 0, 0, APX, APY);
	this.reset.zone.on('pointerdown', () => this.reset_game_state());

	this.restart = this.add_button(RESTART_X, RESTART_Y, "NEW PUZZLE", ACTION_FONTSIZE, COLOR_RED, 0, 0, APX, APY);
	this.restart.zone.on('pointerdown', () => { this.generate_puzzle(); this.set_active_mode('practice'); this.reset_game_state(); });

	this.solved = this.add_button(SOLUTION_X, SOLUTION_Y, "SOLUTION", ACTION_FONTSIZE, COLOR_RED, 1, 0, APX, APY);
	this.solved.zone.on('pointerdown', () => this.show_solution());

	// Rules button replaces the old mute toggle
	this.rules_button = this.add_button(SOUND_TOGGLE_X, SOUND_TOGGLE_Y, "RULES", ACTION_FONTSIZE, COLOR_RED, 1, 0, APX, APY);
	this.rules_modal = this.create_rules_modal();
	this.rules_button.zone.on('pointerdown', () => this.rules_modal.setVisible(true));

	this.load_gamemodes();
    }

    // A dismissible overlay explaining the rules
    create_rules_modal() {
	const container = this.add.container(0, 0).setDepth(1000).setVisible(false);

	const backdrop = this.add.rectangle(0, 0, WINDOW_WIDTH, WINDOW_HEIGHT, 0x000000, 0.75).setOrigin(0, 0).setInteractive();

	const bw = WINDOW_WIDTH * 0.85, bh = WINDOW_HEIGHT * 0.7;
	const bx = (WINDOW_WIDTH - bw) / 2, by = (WINDOW_HEIGHT - bh) / 2;
	const fillColor = Phaser.Display.Color.HexStringToColor(COLOR_BOX_FILL).color;
	const mutedColor = Phaser.Display.Color.HexStringToColor(COLOR_MUTED).color;
	const panel = this.add.graphics();
	panel.fillStyle(0x000000, 0.5).fillRoundedRect(bx + 4, by + 6, bw, bh, 14);
	panel.fillStyle(fillColor, 1).fillRoundedRect(bx, by, bw, bh, 14);
	panel.lineStyle(1.5, mutedColor, 0.8).strokeRoundedRect(bx, by, bw, bh, 14);

	const title = this.add.text(WINDOW_WIDTH / 2, by + 28, "HOW TO PLAY",
				    { fontSize: 28, fontFamily: "'Inter', sans-serif", color: COLOR_TEXT, fontStyle: "600" })
	      .setOrigin(0.5, 0).setResolution(RESOLUTION);

	const body_str =
	    "Get from the start word to the goal word by\n" +
	    "adding, removing, or changing one letter at\n" +
	    "a time. Every intermediate word must be a\n" +
	    "valid English word.\n" +
	    "\n" +
	    "DAILY PUZZLE: a curated pair, refreshed daily.\n" +
	    "PRACTICE: unlimited random pairs.\n" +
	    "FREE PLAY: pick your own start and goal.\n" +
	    "\n" +
	    "Tap anywhere to close.";
	const body = this.add.text(WINDOW_WIDTH / 2, by + 80, body_str,
				   { fontSize: 17, fontFamily: "'Inter', sans-serif", color: COLOR_TEXT,
				     align: "center", lineSpacing: 6 })
	      .setOrigin(0.5, 0).setResolution(RESOLUTION);

	container.add([backdrop, panel, title, body]);
	backdrop.on('pointerdown', () => container.setVisible(false));
	return container;
    }

    // Load game mode buttons (with bubble boxes). Daily Puzzle is
    // rendered at full size; the side buttons are ~10% smaller so
    // Daily visually stands out as the primary option.
    load_gamemodes() {
	const PAD_X = 18, PAD_Y = 10;
	const SIDE_FONT = Math.round(WORD_FONTSIZE * 0.9);
	const SIDE_PAD_X = Math.round(PAD_X * 0.9), SIDE_PAD_Y = Math.round(PAD_Y * 0.9);

	// Practice — endless play with random word pairs
	this.regular = this.add_button(GMODE1_X, GMODE1_Y, "PRACTICE", SIDE_FONT, COLOR_RED, 0, 0, SIDE_PAD_X, SIDE_PAD_Y);
	this.regular.zone.on('pointerdown', () => {
	    this.generate_puzzle();
	    this.set_active_mode('practice');
	    this.reset_game_state();
	});

	// Daily puzzle — curated start/goal pair
	this.daily_challenge = this.add_button(GMODE2_X, GMODE2_Y, "DAILY PUZZLE", WORD_FONTSIZE, COLOR_GREEN, 0.5, 0, PAD_X, PAD_Y);
	this.daily_challenge.zone.on('pointerdown', () => {
	    this.start_word = this.daily_start;
	    this.goal_word.setText(this.daily_goal);
	    this.word_path = calc_word_path(this.start_word, this.goal_word.text, this.word_array, this.word_graph);
	    this.set_active_mode('daily');
	    this.reset_game_state();
	});

	// Free play — user enters start and goal words
	this.free_play = this.add_button(GMODE3_X, GMODE3_Y, "FREE PLAY", SIDE_FONT, COLOR_RED, 1, 0, SIDE_PAD_X, SIDE_PAD_Y);
	this.free_play.zone.on('pointerdown', () => {
	    this.start_word = "???";
	    this.goal_word.setText("???");
	    this.set_active_mode('freeplay');
	    this.reset_game_state();
	    this.error_msg.setText("Enter starting word.");
	    this.freeplay_stage = FREEPLAY_STAGES["first_word"];
	});
    }

    // Load dictionary as array
    load_dictionary() {
	let cache = this.cache.text;
	let file_str = cache.get('word_graph');
	let file_lines = file_str.replaceAll('\r','').split('\n');

	this.word_array = [];
	this.word_graph = [];
	for (let i = 0; i < file_lines.length; i++) {
	    if (file_lines[i] === '')
		continue;
	    let line_array = file_lines[i].split(",");
	    this.word_array.push(line_array[0]);
	    let neighbors_array = line_array.slice(1);
	    if (neighbors_array[0].length > 0)
		this.word_graph.push(neighbors_array.map(Number));
	    else
		this.word_graph.push([]);
	}

	this.start_words_array = [];
	for (let i = 0; i < this.word_array.length; i++) {
	    if (this.word_array[i].length >= MIN_START_WORD_LENGTH
		&& this.word_array[i].length <= MAX_START_WORD_LENGTH
		&& this.word_graph[i].length >= 3)
		this.start_words_array.push(this.word_array[i]);
	}
    }

    load_complaints() {                
	this.complaints_array = ['WHAT ARE YOU DOING','STOP','PLEASE','CONTROL YOURSELF','HAVE YOU NO SHAME','RESET PLEASE','OR ELSE','','','','HAPPY NOW?','GOODBYE'];
    }

}
