class Game extends Phaser.Scene {

    constructor() {
	super('game');

	this.word_array;
	this.word_graph;
	this.start_words_array;

	this.start_word;
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
	
	this.sound_toggle;
	this.bgm;
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

	// Add music
	this.bgm = this.sound.add("worm_game_music", {loop : true});
	this.bgm.play();

	//this.generate_puzzle();
	this.start_word = DAILY_START_WORD;
	this.goal_word.setText(DAILY_GOAL_WORD);
	this.word_path = calc_word_path(this.start_word,this.goal_word.text,this.word_array,this.word_graph)
	this.reset_game_state();
    }

    // Add a text element with some default settings
    add_text(x, y, text_str, fontsize, color = COLOR_TEXT) {
	let new_text = this.add.text(x, y, text_str,
				     { fontSize: fontsize, fontFamily: "'Inter', sans-serif", color: color}).setResolution(RESOLUTION);
	new_text.setOrigin(0.5,0.5);
	return new_text;
    }

    // Reset game variables
    reset_game_state() {
	this.error_msg.setText("");
	this.count = 0;
	this.VICTORY = false;
	this.complaint_counter = 0;
	this.freeplay_stage = FREEPLAY_STAGES["none"];
	this.score_counter.setText("0");
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
	for (let words in this.word_path) {
	    console.log(words);
	    this.word_history.text = this.word_history.text + "\n> " +this.word_path[words].toUpperCase();
	    this.prev_word.setText(words);
	    if (!this.check_victory(words)) {
		if (this.word_history.displayHeight > HISTORY_BOX_H)
		    this.word_history.y = HISTORY_BOX_Y + HISTORY_BOX_H - this.word_history.displayHeight;
	    }
	}
	this.error_msg.setText(`One ideal solution was ${this.word_path.length-1} steps.`);
	
    }
    // Display the error message with some default settings
    display_error_message(error_str) {
	this.shake_input.shake();
	let prev_msg = this.error_msg.text;
	this.error_msg.setText(error_str);
	this.timedEvent = this.time.delayedCall(2000, function (event) {this.error_msg.setText(prev_msg)}, [], this); 
    }

    // Do some stuff when enter is pressed on the input box
    handle_press_enter() {
	// If not an English word
	let input_word = this.input_box.getChildByName("input_word").value.toUpperCase();
        this.input_box.getChildByName("input_word").value = "";
	if (!this.check_word_in_dictionary(input_word)){
	    this.display_error_message(`${input_word} is not an English word!`);
	    return;
	}

	// Entering the first word for freeplay mode
	if (this.freeplay_stage == FREEPLAY_STAGES["first_word"]) {
	    this.start_word = input_word;
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
	    this.prev_word.setText(input_word);
	    if (!this.check_victory(input_word)) {
		this.score_counter.setText(++this.count);
		if (this.word_history.displayHeight > HISTORY_BOX_H)
		    this.word_history.y = HISTORY_BOX_Y + HISTORY_BOX_H - this.word_history.displayHeight;
	    } else {
		let word_path = calc_word_path(this.start_word,input_word,this.word_array,this.word_graph)
		
		this.error_msg.setText(`The shortest possible path is ${word_path.length-1} steps.`);
		this.score_counter.setText(`WIN IN ${++this.count}!`);
		this.VICTORY = true;
		this.prev_word.setText("");
		//this.goal_word.setText("");
	    }
	}
    }

    // Check if the word is off by one letter from prev word
    check_word_off_by_one(input_word) {
	let prev_word = this.prev_word.text;
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

	//Sound button. Toggles mute.
	this.sound_toggle = this.add_text(SOUND_TOGGLE_X,SOUND_TOGGLE_Y,"MUTE",WORD_FONTSIZE,COLOR_RED);
	this.sound_toggle.setOrigin(1,0);
	this.sound_toggle.setInteractive();
	this.sound_toggle.on('pointerdown', function (event) {
	    if (!this.bgm.mute) {
		this.bgm.mute = true;
		this.sound_toggle.alpha = 0.2;
	    } else {
		this.bgm.mute = false;
		this.sound_toggle.alpha = 1.;
	    }
	}, this);

	//Reset button. This will clear the word history and word count while retaining the same start and end word.
	this.reset = this.add_text(RESET_X,RESET_Y,"RESET",WORD_FONTSIZE,COLOR_RED);
	this.reset.setOrigin(0,0);                           
	this.reset.setInteractive();
	this.reset.on('pointerdown',function (event) {
	    this.reset_game_state();
	}, this);

	//New game button.
	this.restart = this.add_text(RESTART_X,RESTART_Y,"NEW PUZZLE",WORD_FONTSIZE,COLOR_RED);
	this.restart.setOrigin(0,0);
	this.restart.setInteractive();
	this.restart.on('pointerdown',function (event) {
	    this.generate_puzzle();
	    this.reset_game_state();
	}, this);
	
	//Solution button.
	this.solved = this.add_text(SOLUTION_X,SOLUTION_Y,"SOLUTION",WORD_FONTSIZE,COLOR_RED);
	this.solved.setOrigin(1,0);
	this.solved.setInteractive();
	this.solved.on('pointerdown',function (event) {
	    this.show_solution();
	}, this);
	
	this.load_gamemodes();
    }

    // Load game mode buttons
    load_gamemodes() {

	//Daily challenge. The start and goal words are set by the developers in game_mode_settings.js
	this.daily_challenge = this.add_text(GMODE2_X,GMODE2_Y,"DAILY PUZZLE",WORD_FONTSIZE,COLOR_GREEN);
	this.daily_challenge.setOrigin(0.5,0);
	this.daily_challenge.setInteractive();
	this.daily_challenge.on('pointerdown',function(event){
	    this.start_word = DAILY_START_WORD;
	    this.goal_word.setText(DAILY_GOAL_WORD);
	    console.log(this.start_word,this.goal_word)
	    this.word_path = calc_word_path(this.start_word,this.goal_word.text,this.word_array,this.word_graph);
	    this.regular = this.add_text(GMODE1_X,GMODE1_Y,"PRACTICE",WORD_FONTSIZE,COLOR_RED);
	    this.regular.setOrigin(0,0);
	    this.daily_challenge = this.add_text(GMODE2_X,GMODE2_Y,"DAILY PUZZLE",WORD_FONTSIZE,COLOR_GREEN);
	    this.daily_challenge.setOrigin(0.5,0);
	    this.free_play = this.add_text(GMODE3_X,GMODE3_Y,"FREE PLAY",WORD_FONTSIZE,COLOR_RED);
	    this.free_play.setOrigin(1,0);
	    this.reset_game_state();
	    
	}, this);
	//Practice mode. This is an endless play mode where start and goal words are picked from the dictionary.
	this.regular = this.add_text(GMODE1_X,GMODE1_Y,"PRACTICE",WORD_FONTSIZE,COLOR_RED);
	this.regular.setOrigin(0,0);
	this.regular.setInteractive();
	this.regular.on('pointerdown',function(event){
	    this.generate_puzzle();
	    this.regular = this.add_text(GMODE1_X,GMODE1_Y,"PRACTICE",WORD_FONTSIZE,COLOR_GREEN);
	    this.regular.setOrigin(0,0);
	    this.daily_challenge = this.add_text(GMODE2_X,GMODE2_Y,"DAILY PUZZLE",WORD_FONTSIZE,COLOR_RED);
	    this.daily_challenge.setOrigin(0.5,0);
	    this.free_play = this.add_text(GMODE3_X,GMODE3_Y,"FREE PLAY",WORD_FONTSIZE,COLOR_RED);
	    this.free_play.setOrigin(1,0);
	    this.reset_game_state();
	}, this);

	//Free Play. Start and ends goal words are chosen by the user.
	this.free_play = this.add_text(GMODE3_X,GMODE3_Y,"FREE PLAY",WORD_FONTSIZE,COLOR_RED);
	this.free_play.setOrigin(1,0);
	this.free_play.setInteractive();
	this.free_play.on('pointerdown',function(event){
	    this.start_word = "???";
	    this.goal_word.setText("???");
	    
	    this.regular = this.add_text(GMODE1_X,GMODE1_Y,"PRACTICE",WORD_FONTSIZE,COLOR_RED);
	    this.regular.setOrigin(0,0);
	    this.daily_challenge = this.add_text(GMODE2_X,GMODE2_Y,"DAILY PUZZLE",WORD_FONTSIZE,COLOR_RED);
	    this.daily_challenge.setOrigin(0.5,0);
	    this.free_play = this.add_text(GMODE3_X,GMODE3_Y,"FREE PLAY",WORD_FONTSIZE,COLOR_GREEN);
	    this.free_play.setOrigin(1,0);

	    this.reset_game_state();
	    this.error_msg.setText("Enter starting word.");
	    this.freeplay_stage = FREEPLAY_STAGES["first_word"];
	}, this);
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
