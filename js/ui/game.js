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
	this.GAVE_UP;
	this.stats_recorded;
	this.complaint_counter;
	this.freeplay_stage;
	this.stats;
	this.mode;
	
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
	this.stats = this.load_stats();
	this.mode = 'daily';
	this.set_active_mode('daily');
	this.start_word = this.daily_start;
	this.goal_word.setText(this.daily_goal);
	this.word_path = calc_word_path(this.start_word,this.goal_word.text,this.word_array,this.word_graph)
	const saved = this.load_daily_state();
	if (saved) this.apply_daily_state(saved);
	else this.reset_game_state();
	// If today's daily is already complete (won or gave up), surface
	// the stats modal straight away so the player sees their result.
	if (saved && (saved.victory || saved.gave_up)) {
	    this.show_stats_modal('daily', !!saved.victory);
	}
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
	zone.on('pointerover', () => { if (zone.input && zone.input.enabled) draw(0.95); });
	zone.on('pointerout',  () => draw(0.5));
	return { text, box, zone, draw, color: text_color };
    }

    // Grey out a button: mute text, reset box, disable input events.
    // Passing enabled=true restores the original color and interactivity.
    set_button_enabled(btn, enabled) {
	if (!btn) return;
	if (enabled) {
	    btn.text.setColor(btn.color);
	    btn.text.alpha = 1;
	    btn.zone.input.enabled = true;
	} else {
	    btn.text.setColor(COLOR_MUTED);
	    btn.text.alpha = 0.5;
	    btn.draw(0.5);
	    btn.zone.input.enabled = false;
	}
    }

    // Reset / Solution (or Give Up) state depend on mode + whether the
    // game has ended. Free Play's Solution button is a soft-disabled
    // variant that's still clickable (to show a lockout message) until
    // today's daily puzzle has been completed.
    refresh_button_states() {
	if (!this.reset || !this.solved) return;
	const ended = this.game_over();
	this.set_button_enabled(this.reset, !ended);
	if (this.restart) this.set_button_enabled(this.restart, this.mode !== 'freeplay');

	if (this.mode === 'freeplay') {
	    const unlocked = this.daily_ended_today();
	    if (unlocked) {
		this.solved.text.setColor(this.solved.color);
		this.solved.text.alpha = 1;
	    } else {
		this.solved.text.setColor(COLOR_MUTED);
		this.solved.text.alpha = 0.5;
		this.solved.draw(0.5);
	    }
	    this.solved.zone.input.enabled = true;
	} else if (this.mode === 'practice' && ended) {
	    // Button is labelled "NEW GAME" here — always active.
	    this.set_button_enabled(this.solved, true);
	} else {
	    // Daily / Practice mid-game: enabled only while game is running.
	    this.set_button_enabled(this.solved, !ended);
	}
    }

    // Swap the SOLUTION / GIVE UP / NEW GAME button to match the current
    // mode + whether the practice game has ended. The button is rebuilt
    // so the bubble resizes to fit the new label.
    update_solution_button() {
	const APX = 12, APY = 6;
	if (this.solved) {
	    this.solved.text.destroy();
	    this.solved.box.destroy();
	    this.solved.zone.destroy();
	}
	let label;
	let color = COLOR_RED;
	if (this.mode === 'freeplay') label = 'SOLUTION';
	else if (this.mode === 'practice' && this.game_over()) { label = 'NEW GAME'; color = COLOR_GREEN; }
	else label = 'GIVE UP';
	this.solved = this.add_button(SOLUTION_X, SOLUTION_Y, label, ACTION_FONTSIZE, color, 1, 0, APX, APY);
	this.solved.zone.on('pointerdown', () => this.handle_solution_or_giveup());
    }

    handle_solution_or_giveup() {
	if (this.mode === 'freeplay') {
	    if (!this.daily_ended_today()) {
		this.display_error_message("Complete today's daily puzzle first.");
		return;
	    }
	    this.show_solution();
	    return;
	}
	// Practice, game already over: the button has been swapped to
	// "NEW GAME" and rolls a fresh puzzle.
	if (this.mode === 'practice' && this.game_over()) {
	    this.start_new_practice();
	    return;
	}
	// Daily / Practice mid-game: give up.
	if (this.game_over()) return;
	this.give_up();
    }

    give_up() {
	const ideal = (this.word_path && this.word_path.length > 0) ? this.word_path.length - 1 : null;
	this.show_solution();
	this.GAVE_UP = true;
	this.score_counter.setText("GAVE UP");
	if (!this.stats_recorded && (this.mode === 'daily' || this.mode === 'practice')) {
	    this.record_giveup(this.mode);
	    this.stats_recorded = true;
	    this.show_stats_modal(this.mode, false);
	}
	this.save_current_state();
	this.refresh_button_states();
	this.update_solution_button();
    }

    // Update which mode button is highlighted. `mode` is also stored as
    // this.mode so other code can branch on the current game mode (e.g.
    // only the daily puzzle persists its progress to localStorage).
    set_active_mode(mode) {
	this.mode = mode;
	this.regular.text.setColor(mode === 'practice' ? COLOR_GREEN : COLOR_RED);
	this.daily_challenge.text.setColor(mode === 'daily' ? COLOR_GREEN : COLOR_RED);
	this.free_play.text.setColor(mode === 'freeplay' ? COLOR_GREEN : COLOR_RED);
    }

    // ---- Daily puzzle persistence ----
    // Saves the current chain of played words + victory / complaint state
    // under a per-day localStorage key so the state survives mode
    // switches and full page reloads. Keyed by ISO date so each day's
    // puzzle gets its own slot.
    daily_storage_key() {
	if (!this.daily_start || !this.daily_goal) return null;
	const t = new Date();
	const yyyy = t.getFullYear();
	const mm = String(t.getMonth() + 1).padStart(2, '0');
	const dd = String(t.getDate()).padStart(2, '0');
	return `worm_game_daily:${yyyy}-${mm}-${dd}`;
    }

    // Read the current word history back out of the word_history text so
    // we don't need to duplicate it in another field.
    daily_history_words() {
	const raw = this.word_history.text || "";
	const out = [];
	for (const line of raw.split('\n')) {
	    const m = line.match(/^>\s*(.*)$/);
	    if (m && m[1].length > 0) out.push(m[1]);
	}
	return out;
    }

    save_daily_state() {
	if (this.mode !== 'daily') return;
	const key = this.daily_storage_key();
	if (!key) return;
	const state = {
	    start: this.daily_start,
	    goal: this.daily_goal,
	    words: this.daily_history_words(),
	    count: this.count,
	    victory: !!this.VICTORY,
	    gave_up: !!this.GAVE_UP,
	    stats_recorded: !!this.stats_recorded,
	    complaint_counter: this.complaint_counter || 0,
	};
	try { localStorage.setItem(key, JSON.stringify(state)); } catch (e) {}
    }

    load_daily_state() {
	const key = this.daily_storage_key();
	if (!key) return null;
	try {
	    const raw = localStorage.getItem(key);
	    if (!raw) return null;
	    const s = JSON.parse(raw);
	    // Guard against stale state: start/goal must match today's puzzle.
	    if (s.start !== this.daily_start || s.goal !== this.daily_goal) return null;
	    return s;
	} catch (e) { return null; }
    }

    clear_daily_state() {
	const key = this.daily_storage_key();
	if (!key) return;
	try { localStorage.removeItem(key); } catch (e) {}
    }

    // ---- Practice puzzle persistence ----
    // Same shape as the daily store, but no date stamping: the saved
    // practice puzzle persists across sessions / windows until the
    // player solves it, gives up, OR explicitly starts a new puzzle.
    PRACTICE_KEY() { return 'worm_game_practice'; }

    save_practice_state() {
	if (this.mode !== 'practice') return;
	const state = {
	    start: this.start_word,
	    goal: this.goal_word.text,
	    path: this.word_path || [],
	    words: this.daily_history_words(),
	    count: this.count,
	    victory: !!this.VICTORY,
	    gave_up: !!this.GAVE_UP,
	    stats_recorded: !!this.stats_recorded,
	    complaint_counter: this.complaint_counter || 0,
	};
	try { localStorage.setItem(this.PRACTICE_KEY(), JSON.stringify(state)); } catch (e) {}
    }

    load_practice_state() {
	try {
	    const raw = localStorage.getItem(this.PRACTICE_KEY());
	    if (!raw) return null;
	    const s = JSON.parse(raw);
	    if (!s || !s.start || !s.goal) return null;
	    return s;
	} catch (e) { return null; }
    }

    clear_practice_state() {
	try { localStorage.removeItem(this.PRACTICE_KEY()); } catch (e) {}
    }

    apply_practice_state(s) {
	this.error_msg.setText("");
	this.start_word = s.start;
	this.goal_word.setText(s.goal);
	this.word_path = s.path && s.path.length ? s.path :
	    calc_word_path(s.start, s.goal, this.word_array, this.word_graph);
	this.count = s.count || 0;
	this.VICTORY = !!s.victory;
	this.GAVE_UP = !!s.gave_up;
	this.stats_recorded = !!s.stats_recorded;
	this.complaint_counter = s.complaint_counter || 0;
	this.freeplay_stage = FREEPLAY_STAGES["none"];
	const words = (s.words && s.words.length > 0) ? s.words : [s.start.toUpperCase()];
	this.current_word = words[words.length - 1];
	this.prev_word.setText(s.start.toUpperCase());
	this.word_history.setText("> " + words.join("\n> "));
	if (this.word_history.displayHeight > HISTORY_BOX_H)
	    this.word_history.y = HISTORY_BOX_Y + HISTORY_BOX_H - this.word_history.displayHeight;
	else
	    this.word_history.y = HISTORY_BOX_Y;
	if (this.VICTORY) {
	    this.score_counter.setText(`WIN IN ${this.count}!`);
	    this.error_msg.setText(`The shortest possible path is ${this.word_path.length - 1} steps.`);
	} else if (this.GAVE_UP) {
	    this.score_counter.setText("GAVE UP");
	    this.error_msg.setText(`One ideal solution was ${this.word_path.length - 1} steps.`);
	} else {
	    this.score_counter.setText(String(this.count));
	}
	this.refresh_button_states();
	this.update_solution_button();
    }

    // Mode-aware save/clear used by the Enter-word handler and reset.
    save_current_state() {
	if (this.mode === 'daily') this.save_daily_state();
	else if (this.mode === 'practice') this.save_practice_state();
    }

    clear_current_state() {
	if (this.mode === 'daily') this.clear_daily_state();
	else if (this.mode === 'practice') this.clear_practice_state();
    }

    // Tear down the current practice puzzle and roll a fresh one,
    // persisting the new state immediately.
    start_new_practice() {
	this.clear_practice_state();
	this.mode = 'practice';
	this.generate_puzzle();
	this.reset_game_state();
	this.save_practice_state();
	this.update_solution_button();
    }

    // Apply a previously-saved daily state to the UI in place of a fresh
    // reset_game_state(). Assumes this.start_word / goal_word already
    // match the saved puzzle.
    apply_daily_state(s) {
	this.error_msg.setText("");
	this.count = s.count || 0;
	this.VICTORY = !!s.victory;
	this.GAVE_UP = !!s.gave_up;
	this.stats_recorded = !!s.stats_recorded;
	this.complaint_counter = s.complaint_counter || 0;
	this.freeplay_stage = FREEPLAY_STAGES["none"];
	const words = (s.words && s.words.length > 0) ? s.words : [this.start_word.toUpperCase()];
	this.current_word = words[words.length - 1];
	this.prev_word.setText(this.start_word.toUpperCase());
	this.word_history.setText("> " + words.join("\n> "));
	if (this.word_history.displayHeight > HISTORY_BOX_H)
	    this.word_history.y = HISTORY_BOX_Y + HISTORY_BOX_H - this.word_history.displayHeight;
	else
	    this.word_history.y = HISTORY_BOX_Y;
	if (this.VICTORY) {
	    const last = words[words.length - 1];
	    const path = calc_word_path(this.start_word, last, this.word_array, this.word_graph);
	    this.error_msg.setText(`The shortest possible path is ${path.length - 1} steps.`);
	    this.score_counter.setText(`WIN IN ${this.count}!`);
	} else if (this.GAVE_UP) {
	    this.error_msg.setText(`One ideal solution was ${this.word_path.length - 1} steps.`);
	    this.score_counter.setText("GAVE UP");
	} else {
	    this.score_counter.setText(String(this.count));
	}
	this.refresh_button_states();
    }

    // ---- Persistent stats (daily + practice) ----
    STATS_KEY() { return 'worm_game_stats'; }

    default_stats() {
	return {
	    daily:    { streak: 0, best_streak: 0, last_win_date: null, wins: 0, giveups: 0, distribution: {} },
	    practice: { streak: 0, best_streak: 0,                     wins: 0, giveups: 0, distribution: {} }
	};
    }

    load_stats() {
	let s = this.default_stats();
	try {
	    const raw = localStorage.getItem(this.STATS_KEY());
	    if (raw) {
		const parsed = JSON.parse(raw);
		s.daily    = Object.assign(s.daily,    parsed.daily    || {});
		s.practice = Object.assign(s.practice, parsed.practice || {});
		s.daily.distribution    = s.daily.distribution    || {};
		s.practice.distribution = s.practice.distribution || {};
	    }
	} catch (e) {}
	return s;
    }

    save_stats() {
	try { localStorage.setItem(this.STATS_KEY(), JSON.stringify(this.stats)); } catch (e) {}
    }

    iso_today() {
	const d = new Date();
	return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    }

    iso_yesterday() {
	const d = new Date();
	d.setDate(d.getDate() - 1);
	return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    }

    // Did today's daily end (won or gave up)?
    daily_ended_today() {
	const key = this.daily_storage_key();
	if (!key) return false;
	try {
	    const raw = localStorage.getItem(key);
	    if (!raw) return false;
	    const s = JSON.parse(raw);
	    return !!(s.victory || s.gave_up);
	} catch (e) { return false; }
    }

    record_win(mode, over_par) {
	const st = this.stats[mode];
	if (mode === 'daily') {
	    const today = this.iso_today();
	    if (st.last_win_date === this.iso_yesterday()) st.streak += 1;
	    else if (st.last_win_date !== today) st.streak = 1;
	    st.last_win_date = today;
	} else {
	    st.streak += 1;
	}
	if (st.streak > st.best_streak) st.best_streak = st.streak;
	st.wins = (st.wins || 0) + 1;
	const key = String(over_par);
	st.distribution[key] = (st.distribution[key] || 0) + 1;
	this.save_stats();
    }

    record_giveup(mode) {
	const st = this.stats[mode];
	st.streak = 0;
	st.giveups = (st.giveups || 0) + 1;
	this.save_stats();
    }

    // Reset game variables
    reset_game_state() {
	this.error_msg.setText("");
	this.count = 0;
	this.VICTORY = false;
	this.GAVE_UP = false;
	this.stats_recorded = false;
	this.complaint_counter = 0;
	this.freeplay_stage = FREEPLAY_STAGES["none"];
	this.score_counter.setText("0");
	this.current_word = this.start_word.toUpperCase();
	this.prev_word.setText(this.start_word.toUpperCase());
	this.word_history.setText("> "+this.start_word.toUpperCase());
	this.word_history.y = HISTORY_BOX_Y;
	this.refresh_button_states();
    }

    game_over() { return this.VICTORY || this.GAVE_UP; }
    
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
	if (this.modal_open) return;
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
	    this.save_current_state();

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

		const ideal_steps = word_path.length - 1;
		this.error_msg.setText(`The shortest possible path is ${ideal_steps} steps.`);
		this.score_counter.setText(`WIN IN ${++this.count}!`);
		this.VICTORY = true;
		if (!this.stats_recorded && (this.mode === 'daily' || this.mode === 'practice')) {
		    const over = Math.max(0, this.count - ideal_steps);
		    this.record_win(this.mode, over);
		    this.stats_recorded = true;
		    this.show_stats_modal(this.mode, true);
		}
		this.refresh_button_states();
		this.update_solution_button();
	    }
	    this.save_current_state();
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
	this.reset.zone.on('pointerdown', () => {
	    if (this.game_over()) return;
	    this.reset_game_state();
	    this.save_current_state();
	});

	// Was "NEW PUZZLE"; now opens the stats modal for the current
	// mode. In free play there are no stats to show, so the button is
	// visible but disabled.
	this.restart = this.add_button(RESTART_X, RESTART_Y, "STATISTICS", ACTION_FONTSIZE, COLOR_RED, 0, 0, APX, APY);
	this.restart.zone.on('pointerdown', () => {
	    if (this.mode === 'freeplay') return;
	    this.show_stats_modal(this.mode, !!this.VICTORY);
	});

	// Solution / Give Up button is owned by update_solution_button so
	// the label (and size) tracks the current mode.
	this.update_solution_button();

	// Rules button replaces the old mute toggle
	this.rules_button = this.add_button(SOUND_TOGGLE_X, SOUND_TOGGLE_Y, "RULES", ACTION_FONTSIZE, COLOR_RED, 1, 0, APX, APY);
	this.rules_modal = this.create_rules_modal();
	this.rules_button.zone.on('pointerdown', () => this.rules_modal.setVisible(true));

	this.load_gamemodes();
    }

    // Build + show a dismissible stats overlay. `won` controls the title
    // (finished vs. gave up); mode selects which stats bucket to read.
    // Always renders the same fixed set of outcome bars (Ideal, 1..4, 5+,
    // Gave Up) so layouts stay consistent as the player's history grows.
    // Bars are drawn as rounded segments for a worm-body look.
    show_stats_modal(mode, won) {
	const st = this.stats[mode];
	const container = this.add.container(0, 0).setDepth(1000);
	const backdrop = this.add.rectangle(0, 0, WINDOW_WIDTH, WINDOW_HEIGHT, 0x000000, 0.75)
	      .setOrigin(0, 0).setInteractive();

	const bw = WINDOW_WIDTH * 0.85, bh = WINDOW_HEIGHT * 0.82;
	const bx = (WINDOW_WIDTH - bw) / 2, by = (WINDOW_HEIGHT - bh) / 2;
	const fillColor  = Phaser.Display.Color.HexStringToColor(COLOR_BOX_FILL).color;
	const mutedColor = Phaser.Display.Color.HexStringToColor(COLOR_MUTED).color;
	const greenColor = Phaser.Display.Color.HexStringToColor(COLOR_GREEN).color;
	const redColor   = Phaser.Display.Color.HexStringToColor(COLOR_RED).color;

	const panel = this.add.graphics();
	panel.fillStyle(0x000000, 0.5).fillRoundedRect(bx + 4, by + 6, bw, bh, 14);
	panel.fillStyle(fillColor, 1).fillRoundedRect(bx, by, bw, bh, 14);
	panel.lineStyle(1.5, mutedColor, 0.8).strokeRoundedRect(bx, by, bw, bh, 14);

	// Big titular "WORM GAME" in the playful display font.
	const header = this.add.text(WINDOW_WIDTH / 2, by + 20, "WORM GAME",
				     { fontSize: 40, fontFamily: "'Fredoka', 'Inter', sans-serif",
				       color: COLOR_GREEN, fontStyle: "700" })
	      .setOrigin(0.5, 0).setResolution(RESOLUTION);

	const mode_label = (mode === 'daily') ? 'DAILY PUZZLE' : 'PRACTICE';
	const subtitle_str = won ? `${mode_label} — SOLVED` : `${mode_label} — GAVE UP`;
	const subtitle = this.add.text(WINDOW_WIDTH / 2, by + 76, subtitle_str,
				       { fontSize: 20, fontFamily: "'Inter', sans-serif",
					 color: won ? COLOR_GREEN : COLOR_RED, fontStyle: "600" })
	      .setOrigin(0.5, 0).setResolution(RESOLUTION);

	const summary_str = `Streak: ${st.streak}   Best: ${st.best_streak}\n` +
			    `Wins: ${st.wins || 0}   Give ups: ${st.giveups || 0}`;
	const summary = this.add.text(WINDOW_WIDTH / 2, by + 112, summary_str,
				      { fontSize: 16, fontFamily: "'Inter', sans-serif",
					color: COLOR_TEXT, align: "center", lineSpacing: 4 })
	      .setOrigin(0.5, 0).setResolution(RESOLUTION);

	const section_header = this.add.text(WINDOW_WIDTH / 2, by + 168, "Outcome distribution",
					     { fontSize: 13, fontFamily: "'Inter', sans-serif", color: COLOR_MUTED })
	      .setOrigin(0.5, 0).setResolution(RESOLUTION);

	// Bucket the distribution + the give-up count.
	const dist = st.distribution || {};
	const bucket = (k) => dist[String(k)] || 0;
	const over_5_plus = Object.keys(dist).map(Number)
	      .filter(k => k >= 5)
	      .reduce((s, k) => s + dist[String(k)], 0);
	const rows = [
	    { label: 'Ideal',   count: bucket(0),          color: greenColor },
	    { label: '1',       count: bucket(1),          color: greenColor },
	    { label: '2',       count: bucket(2),          color: greenColor },
	    { label: '3',       count: bucket(3),          color: greenColor },
	    { label: '4',       count: bucket(4),          color: greenColor },
	    { label: '5+',      count: over_5_plus,        color: greenColor },
	    { label: 'Gave Up', count: st.giveups || 0,    color: redColor   },
	];
	const max_count = Math.max(1, ...rows.map(r => r.count));

	// Column positions. Labels are right-aligned 10 px left of the bar
	// start; the bar track is fixed width; the count is right-aligned
	// ~20 px past the bar end.
	const bar_x = bx + 115;
	const bar_end_x = bx + bw - 55;
	const bar_w_full = bar_end_x - bar_x;
	const count_col_x = bar_end_x + 20;
	const bar_h = 18;
	const row_gap = 30;
	const rows_start_y = by + 196;
	const label_right_x = bar_x - 10;

	// Draw an earthworm-like shape on `g`: smooth rounded body that
	// tapers to a narrow rounded tip at each end, with thin darker rib
	// lines across the middle to evoke segmentation (without cutting
	// the body into pieces).
	const draw_worm = (g, x, y, w, h, color_int) => {
	    if (w <= 0) return;
	    const cy = y + h / 2;
	    // Taper region width: how much of the length is used to ramp
	    // the body outline from a narrow tip up to full body height.
	    const taper = Math.min(h * 0.85, w / 2);
	    // Vertical half-height at the tip itself (narrower than body).
	    const tip_hh = h * 0.18;

	    g.fillStyle(color_int, 0.95);
	    g.beginPath();
	    // Top edge: narrow left tip → curve up to body top → along → curve down to right tip.
	    g.moveTo(x, cy - tip_hh);
	    g.quadraticCurveTo(x, y, x + taper, y);
	    g.lineTo(x + w - taper, y);
	    g.quadraticCurveTo(x + w, y, x + w, cy - tip_hh);
	    // Right tip edge.
	    g.lineTo(x + w, cy + tip_hh);
	    // Bottom edge, mirrored.
	    g.quadraticCurveTo(x + w, y + h, x + w - taper, y + h);
	    g.lineTo(x + taper, y + h);
	    g.quadraticCurveTo(x, y + h, x, cy + tip_hh);
	    g.closePath();
	    g.fillPath();

	    // Segmentation: thin darker lines across the body, clear of the
	    // tapered tips so the rings don't overshoot the silhouette.
	    const rib_spacing = 20;
	    const rib_start = x + taper + 3;
	    const rib_end = x + w - taper - 3;
	    g.lineStyle(1.2, 0x000000, 0.28);
	    for (let rx = rib_start + rib_spacing - 3; rx <= rib_end; rx += rib_spacing) {
		g.beginPath();
		g.moveTo(rx, y + 2);
		g.lineTo(rx, y + h - 2);
		g.strokePath();
	    }
	};

	const items = [backdrop, panel, header, subtitle, summary, section_header];
	for (let i = 0; i < rows.length; i++) {
	    const r = rows[i];
	    const row_y = rows_start_y + i * row_gap;

	    const label = this.add.text(label_right_x, row_y + bar_h / 2, r.label,
					{ fontSize: 14, fontFamily: "'Inter', sans-serif", color: COLOR_TEXT })
		  .setOrigin(1, 0.5).setResolution(RESOLUTION);

	    const bar = this.add.graphics();
	    // Empty track along the full width, so zero-count rows still
	    // read as a slot in the chart.
	    bar.fillStyle(mutedColor, 0.20).fillRoundedRect(bar_x, row_y, bar_w_full, bar_h, bar_h / 2);
	    if (r.count > 0) {
		const fw = (r.count / max_count) * bar_w_full;
		draw_worm(bar, bar_x, row_y, fw, bar_h, r.color);
	    }

	    const count = this.add.text(count_col_x, row_y + bar_h / 2, String(r.count),
					{ fontSize: 14, fontFamily: "'Inter', sans-serif", color: COLOR_TEXT })
		  .setOrigin(1, 0.5).setResolution(RESOLUTION);

	    items.push(label, bar, count);
	}

	container.add(items);

	// Dismissal: click backdrop OR Enter / Space / Escape. Keyboard
	// close is locked out for the first second so the same Enter that
	// submitted the winning word (and opened this modal) doesn't also
	// dismiss it. Pointer taps are never locked out.
	// The modal_open flag lingers for one extra tick after close so the
	// dismissing keystroke isn't picked up by handle_press_enter.
	const kb = this.input.keyboard;
	const opened_at = performance.now();
	const KEY_LOCKOUT_MS = 1000;
	const close = (via_key) => {
	    if (container.__closed) return;
	    if (via_key && performance.now() - opened_at < KEY_LOCKOUT_MS) return;
	    container.__closed = true;
	    kb.off('keydown-ENTER', close_by_key);
	    kb.off('keydown-SPACE', close_by_key);
	    kb.off('keydown-ESC', close_by_key);
	    this.time.delayedCall(0, () => { this.modal_open = false; });
	    container.destroy();
	};
	const close_by_key = () => close(true);
	const close_by_pointer = () => close(false);

	// Practice-only action buttons, shown when the stats modal pops up
	// with a finished game: View Ideal Solution + New Puzzle.
	const show_actions = (mode === 'practice' && this.game_over());
	if (show_actions) {
	    const btn_y = by + bh - 46;
	    const view_btn = this.add_button(bx + bw * 0.28, btn_y, "VIEW IDEAL SOLUTION",
					     14, COLOR_TEXT, 0.5, 0.5, 12, 7);
	    view_btn.zone.on('pointerdown', () => {
		this.show_solution();
		close(false);
	    });
	    const new_btn = this.add_button(bx + bw * 0.72, btn_y, "NEW PUZZLE",
					    14, COLOR_GREEN, 0.5, 0.5, 12, 7);
	    new_btn.zone.on('pointerdown', () => {
		close(false);
		this.start_new_practice();
	    });
	    container.add([view_btn.box, view_btn.text, view_btn.zone,
			   new_btn.box, new_btn.text, new_btn.zone]);
	} else {
	    const tip = this.add.text(WINDOW_WIDTH / 2, by + bh - 22,
				      "Tap, or press Enter / Space / Esc to close.",
				      { fontSize: 12, fontFamily: "'Inter', sans-serif", color: COLOR_MUTED })
		  .setOrigin(0.5, 0.5).setResolution(RESOLUTION);
	    container.add(tip);
	}

	this.modal_open = true;
	kb.on('keydown-ENTER', close_by_key);
	kb.on('keydown-SPACE', close_by_key);
	kb.on('keydown-ESC', close_by_key);
	backdrop.on('pointerdown', close_by_pointer);
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

	// Practice — persists the current puzzle across sessions; tapping
	// the button simply brings you back to whatever practice game is
	// currently in progress (or rolls a new one if there isn't one).
	this.regular = this.add_button(GMODE1_X, GMODE1_Y, "PRACTICE", SIDE_FONT, COLOR_RED, 0, 0, SIDE_PAD_X, SIDE_PAD_Y);
	this.regular.zone.on('pointerdown', () => {
	    this.set_active_mode('practice');
	    const saved = this.load_practice_state();
	    if (saved) {
		this.apply_practice_state(saved);
	    } else {
		this.generate_puzzle();
		this.reset_game_state();
		this.save_practice_state();
	    }
	    this.update_solution_button();
	});

	// Daily puzzle — curated start/goal pair
	this.daily_challenge = this.add_button(GMODE2_X, GMODE2_Y, "DAILY PUZZLE", WORD_FONTSIZE, COLOR_GREEN, 0.5, 0, PAD_X, PAD_Y);
	this.daily_challenge.zone.on('pointerdown', () => {
	    this.start_word = this.daily_start;
	    this.goal_word.setText(this.daily_goal);
	    this.word_path = calc_word_path(this.start_word, this.goal_word.text, this.word_array, this.word_graph);
	    this.set_active_mode('daily');
	    this.update_solution_button();
	    const saved = this.load_daily_state();
	    if (saved) this.apply_daily_state(saved);
	    else this.reset_game_state();
	});

	// Free play — user enters start and goal words
	this.free_play = this.add_button(GMODE3_X, GMODE3_Y, "FREE PLAY", SIDE_FONT, COLOR_RED, 1, 0, SIDE_PAD_X, SIDE_PAD_Y);
	this.free_play.zone.on('pointerdown', () => {
	    this.start_word = "???";
	    this.goal_word.setText("???");
	    this.set_active_mode('freeplay');
	    this.update_solution_button();
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
