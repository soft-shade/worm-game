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
	this.init_auth();
	this.mode = 'daily';
	this.set_active_mode('daily');
	this.start_word = this.daily_start;
	this.goal_word.setText(this.daily_goal);
	this.word_path = calc_word_path(this.start_word,this.goal_word.text,this.word_array,this.word_graph)
	const saved = this.load_daily_state() || this.synth_daily_from_history();
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
	const p = this.et_today_parts();
	const today_str = `${p.day}-${p.month}-${p.year}`;

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
	if (this.undo) this.set_button_enabled(this.undo, !ended);
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
	// On mobile a tap on NEW GAME / NEW PUZZLE can carry over to the
	// freshly-rendered GIVE UP button. Block for 500ms after the
	// puzzle starts so that doesn't accidentally end the new run.
	if (this.giveup_lockout_until && Date.now() < this.giveup_lockout_until) return;
	this.show_giveup_confirm();
    }

    // Small confirmation modal so a fat-fingered tap on GIVE UP can't
    // wipe out a streak. YES calls give_up(); NO just dismisses.
    show_giveup_confirm() {
	if (this.giveup_confirm_open) return;
	this.giveup_confirm_open = true;
	this.modal_open = true;
	const container = this.add.container(0, 0).setDepth(1100);
	const bgColor = Phaser.Display.Color.HexStringToColor(COLOR_BG).color;
	const backdrop = this.add.rectangle(0, 0, WINDOW_WIDTH, WINDOW_HEIGHT, bgColor, 1)
	      .setOrigin(0, 0).setInteractive();
	const bw = WINDOW_WIDTH * 0.7, bh = 180;
	const bx = (WINDOW_WIDTH - bw) / 2, by = (WINDOW_HEIGHT - bh) / 2;
	const fillColor  = Phaser.Display.Color.HexStringToColor(COLOR_BOX_FILL).color;
	const mutedColor = Phaser.Display.Color.HexStringToColor(COLOR_MUTED).color;
	const panel = this.add.graphics();
	panel.fillStyle(0x000000, 0.5).fillRoundedRect(bx + 4, by + 6, bw, bh, 14);
	panel.fillStyle(fillColor, 1).fillRoundedRect(bx, by, bw, bh, 14);
	panel.lineStyle(1.5, mutedColor, 0.8).strokeRoundedRect(bx, by, bw, bh, 14);

	const title = this.add.text(WINDOW_WIDTH / 2, by + 36, "GIVE UP?",
				    { fontSize: 26, fontFamily: "'Inter', sans-serif",
				      color: COLOR_RED, fontStyle: "600" })
	      .setOrigin(0.5, 0.5).setResolution(RESOLUTION);
	const body = this.add.text(WINDOW_WIDTH / 2, by + 78,
				   "This will end your run and break\nyour streak. Are you sure?",
				   { fontSize: 15, fontFamily: "'Inter', sans-serif",
				     color: COLOR_TEXT, align: "center", lineSpacing: 4 })
	      .setOrigin(0.5, 0.5).setResolution(RESOLUTION);

	const btn_y = by + bh - 38;
	const yes_btn = this.add_button(bx + bw * 0.3, btn_y, "YES, GIVE UP", 14, COLOR_RED, 0.5, 0.5, 14, 8);
	const no_btn  = this.add_button(bx + bw * 0.7, btn_y, "CANCEL",       14, COLOR_GREEN, 0.5, 0.5, 14, 8);

	const close = () => {
	    container.destroy();
	    this.giveup_confirm_open = false;
	    // Defer one tick so the dismissing keystroke (if any) doesn't
	    // get picked up by handle_press_enter as a "submit guess".
	    this.time.delayedCall(0, () => { this.modal_open = false; });
	};
	yes_btn.zone.on('pointerdown', () => { close(); this.give_up(); });
	no_btn.zone.on('pointerdown', close);
	backdrop.on('pointerdown', close);

	container.add([backdrop, panel, title, body,
		       yes_btn.box, yes_btn.text, yes_btn.zone,
		       no_btn.box, no_btn.text, no_btn.zone]);
    }

    give_up() {
	const ideal = (this.word_path && this.word_path.length > 0) ? this.word_path.length - 1 : null;
	this.show_solution();
	this.GAVE_UP = true;
	this.score_counter.setText("GAVE UP");
	if (!this.stats_recorded && (this.mode === 'daily' || this.mode === 'practice')
		&& !this.archive_date) {
	    this.record_giveup(this.mode);
	    this.stats_recorded = true;
	    if (this.mode === 'daily') this.contribute_to_aggregate(false, null);
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
	const p = this.et_today_parts();
	return `worm_game_daily:${p.year}-${p.month}-${p.day}`;
    }

    // Sequential puzzle number, with 2026-04-17 (ET) as #1. Pass an ISO
    // date ("YYYY-MM-DD") to get the number for that date; otherwise
    // today (ET) is used.
    daily_puzzle_number(iso) {
	let target;
	if (iso) {
	    target = new Date(`${iso}T12:00:00Z`);
	} else {
	    const p = this.et_today_parts();
	    target = new Date(`${p.year}-${p.month}-${p.day}T12:00:00Z`);
	}
	const ref = new Date('2026-04-17T12:00:00Z');
	return Math.round((target - ref) / 86400000) + 1;
    }

    // Today's calendar date in America/New_York. Daily puzzles roll
    // over at ET midnight regardless of the player's local timezone so
    // that everyone gets the same daily on the same calendar day.
    et_today_parts() {
	const fmt = new Intl.DateTimeFormat('en-CA', {
	    timeZone: 'America/New_York',
	    year: 'numeric', month: '2-digit', day: '2-digit',
	});
	const parts = {};
	for (const p of fmt.formatToParts(new Date())) parts[p.type] = p.value;
	return { year: parts.year, month: parts.month, day: parts.day };
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
	if (this.mode !== 'daily' || this.archive_date) return;
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
	    date: this.iso_today(),
	};
	try { localStorage.setItem(key, JSON.stringify(state)); } catch (e) {}
	// Mirror into the stats doc so signed-in users have it on
	// Firestore too. save_stats handles both the localStorage cache
	// and the debounced Firestore write.
	if (!this.stats) this.stats = this.default_stats();
	if (!this.stats.daily) this.stats.daily = {};
	this.stats.daily.current = state;
	this.save_stats();
    }

    load_daily_state() {
	// Prefer the freshest source: the stats doc's daily.current, which
	// Firestore syncs on sign-in. Only fall back to per-day localStorage
	// when the stats doc has nothing or has a stale date.
	const today = this.iso_today();
	const key = this.daily_storage_key();
	const cur = this.stats && this.stats.daily && this.stats.daily.current;
	if (cur && cur.date === today
		&& cur.start === this.daily_start
		&& cur.goal === this.daily_goal) {
	    try { if (key) localStorage.setItem(key, JSON.stringify(cur)); } catch (e) {}
	    return cur;
	}
	if (!key) return null;
	try {
	    const raw = localStorage.getItem(key);
	    if (!raw) return null;
	    const s = JSON.parse(raw);
	    if (s.start !== this.daily_start || s.goal !== this.daily_goal) return null;
	    return s;
	} catch (e) { return null; }
    }

    // ---- Archive (play a past daily) ----
    // this.archive_date is an ISO date ("YYYY-MM-DD") while the player
    // is working through an old daily via the calendar tab. In archive
    // mode, stats are NOT recorded and the win/give-up flow doesn't
    // pop the stats modal; the player just sees the in-game win/lose
    // text. Exiting back to a mode button clears this.archive_date.
    in_archive() { return !!this.archive_date; }

    lookup_daily_for_date(iso_date) {
	if (!iso_date || iso_date.length !== 10) return null;
	const [y, m, d] = iso_date.split('-');
	const key = `${d}-${m}-${y}`;
	const raw = this.cache.text.get('daily_list') || '';
	for (const line of raw.replaceAll('\r', '').split('\n')) {
	    const trimmed = line.trim();
	    if (!trimmed) continue;
	    const parts = trimmed.split(',');
	    if (parts.length >= 3 && parts[0] === key) {
		return { start: parts[1].toUpperCase(), goal: parts[2].toUpperCase() };
	    }
	}
	return null;
    }

    enter_archive(iso_date) {
	const entry = this.lookup_daily_for_date(iso_date);
	if (!entry) return;
	this.archive_date = iso_date;
	this.set_active_mode('daily');
	this.start_word = entry.start;
	this.goal_word.setText(entry.goal);
	this.word_path = calc_word_path(this.start_word, this.goal_word.text,
					this.word_array, this.word_graph);
	this.reset_game_state();

	// If the player already solved or gave up on this past daily,
	// restore the final state and keep it static — stats must never be
	// edited after the fact. 'solved_late' / 'gave_up_late' come from
	// archive replays; we treat them as completions for restoration but
	// preserve the suffix on the calendar / archive indicator.
	const h = this.stats && this.stats.daily && this.stats.daily.history
		&& this.stats.daily.history[iso_date];
	const solved_results = ['solved', 'solved_late'];
	const giveup_results = ['gave_up', 'gave_up_late'];
	if (h && (solved_results.includes(h.result) || giveup_results.includes(h.result))) {
	    this.VICTORY = solved_results.includes(h.result);
	    this.GAVE_UP = giveup_results.includes(h.result);
	    this.count = h.steps || 0;
	    this.stats_recorded = true;   // safety: prevent any re-record path
	    // Restore the player's actual chain if we saved it. Older
	    // entries pre-date the chain-saving change, so fall back to
	    // showing just the start word.
	    if (Array.isArray(h.words) && h.words.length > 0) {
		this.word_history.setText("> " + h.words.join("\n> "));
		this.current_word = h.words[h.words.length - 1];
		if (this.word_history.displayHeight > HISTORY_BOX_H)
		    this.word_history.y = HISTORY_BOX_Y + HISTORY_BOX_H - this.word_history.displayHeight;
		else
		    this.word_history.y = HISTORY_BOX_Y;
	    }
	    const ideal = (this.word_path && this.word_path.length > 0)
		  ? this.word_path.length - 1 : null;
	    if (this.VICTORY) {
		this.score_counter.setText(`WIN IN ${this.count}!`);
		if (ideal !== null)
		    this.error_msg.setText(`The shortest possible path is ${ideal} steps.`);
	    } else {
		this.score_counter.setText("GAVE UP");
		if (ideal !== null)
		    this.error_msg.setText(`One ideal solution was ${ideal} steps.`);
	    }
	    this.show_solution();
	}

	this.update_solution_button();
	this.update_daily_button();
	this.update_archive_indicator();
    }

    exit_archive() {
	if (!this.archive_date) return;
	this.archive_date = null;
	this.update_archive_indicator();
	this.update_daily_button();
    }

    // (Re)build the centre DAILY PUZZLE button so its label shows
    // either today's puzzle number or, if we're in archive mode, the
    // archived date's number. Rebuild (rather than setText) keeps the
    // bubble centred even when the digit count changes.
    update_daily_button() {
	const PAD_X = 18, PAD_Y = 10;
	if (this.daily_challenge) {
	    this.daily_challenge.text.destroy();
	    this.daily_challenge.box.destroy();
	    this.daily_challenge.zone.destroy();
	}
	const n = this.daily_puzzle_number(this.archive_date || null);
	const label = `DAILY PUZZLE #${n}`;
	this.daily_challenge = this.add_button(GMODE2_X, GMODE2_Y, label,
					       WORD_FONTSIZE, COLOR_GREEN,
					       0.5, 0.5, PAD_X, PAD_Y);
	this.daily_challenge.zone.on('pointerdown', () => {
	    this.exit_archive();
	    this.start_word = this.daily_start;
	    this.goal_word.setText(this.daily_goal);
	    this.word_path = calc_word_path(this.start_word, this.goal_word.text,
					    this.word_array, this.word_graph);
	    this.set_active_mode('daily');
	    this.update_solution_button();
	    const saved = this.load_daily_state() || this.synth_daily_from_history();
	    if (saved) this.apply_daily_state(saved);
	    else this.reset_game_state();
	});
    }

    update_archive_indicator() {
	if (!this.archive_label) return;
	if (this.archive_date) {
	    const d = new Date(this.archive_date + 'T12:00:00Z');
	    const mon = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
	    const h = this.stats && this.stats.daily && this.stats.daily.history
		    && this.stats.daily.history[this.archive_date];
	    const tag_map = {
		'solved':       ' (solved)',
		'gave_up':      ' (gave up)',
		'solved_late':  ' (completed late)',
		'gave_up_late': ' (gave up late)',
	    };
	    const tag = (h && tag_map[h.result]) || '';
	    this.archive_label.setText(
		`ARCHIVE · ${d.getUTCDate()} ${mon[d.getUTCMonth()]} ${d.getUTCFullYear()}${tag} · tap DAILY to return`
	    );
	} else {
	    this.archive_label.setText("");
	}
    }

    // Fallback synthesis when the stats doc tells us today's daily
    // already ended (via daily.history[today]) but no full daily.current
    // record exists — e.g. a user whose saves predate the current-state
    // mirroring, or whose local copy got wiped. Reconstructs enough of
    // the state for the UI to render the game as finished.
    synth_daily_from_history() {
	const today = this.iso_today();
	const st = this.stats && this.stats.daily;
	if (!st || !st.history) return null;
	const h = st.history[today];
	if (!h) return null;
	if (h.result !== 'solved' && h.result !== 'gave_up') return null;
	return {
	    start: this.daily_start,
	    goal: this.daily_goal,
	    words: [this.daily_start.toUpperCase()],
	    count: h.steps || 0,
	    victory: h.result === 'solved',
	    gave_up: h.result === 'gave_up',
	    stats_recorded: true,
	    complaint_counter: 0,
	    date: today,
	};
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
	this.set_prompts_visible(true);
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
	    if (this.ideal_history) this.ideal_history.setText("");
	} else if (this.GAVE_UP) {
	    this.score_counter.setText("GAVE UP");
	    this.show_solution();   // re-render ideal in the right column
	} else {
	    this.score_counter.setText(String(this.count));
	    if (this.ideal_history) this.ideal_history.setText("");
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
	// Block the GIVE UP path briefly: on mobile, the tap that
	// triggered NEW PUZZLE / NEW GAME can still be in flight when
	// the button rerenders into GIVE UP, which would instantly end
	// the run we just started.
	this.giveup_lockout_until = Date.now() + 500;
    }

    // Apply a previously-saved daily state to the UI in place of a fresh
    // reset_game_state(). Assumes this.start_word / goal_word already
    // match the saved puzzle.
    apply_daily_state(s) {
	this.error_msg.setText("");
	this.set_prompts_visible(true);
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
	    // Use the puzzle's own start-to-goal ideal length (already
	    // cached in this.word_path at load time) rather than running
	    // calc_word_path against the player's last word — the last
	    // word may equal the start word for a synthesised state and
	    // would return an empty path (giving "... -1 steps").
	    const ideal = (this.word_path && this.word_path.length > 0)
		  ? this.word_path.length - 1 : null;
	    if (ideal !== null)
		this.error_msg.setText(`The shortest possible path is ${ideal} steps.`);
	    else
		this.error_msg.setText("");
	    this.score_counter.setText(`WIN IN ${this.count}!`);
	    this.show_solution();   // render ideal in the right column too
	} else if (this.GAVE_UP) {
	    this.score_counter.setText("GAVE UP");
	    this.show_solution();   // re-render ideal in the right column
	} else {
	    this.score_counter.setText(String(this.count));
	    if (this.ideal_history) this.ideal_history.setText("");
	}
	this.refresh_button_states();
    }

    // ---- Persistent stats (daily + practice) ----
    STATS_KEY() { return 'worm_game_stats'; }

    default_stats() {
	return {
	    // history: per-date map keyed by ISO ET date.
	    //   { "2026-04-17": { result: "solved",  steps: 7, ideal: 5 },
	    //     "2026-04-19": { result: "gave_up",           ideal: 9 } }
	    // Dates with no entry mean the player didn't play that day.
	    daily:    { streak: 0, best_streak: 0, last_win_date: null, wins: 0, giveups: 0, distribution: {}, history: {} },
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
		s.daily.history         = s.daily.history || {};
	    }
	} catch (e) {}
	this.backfill_daily_history(s);
	return s;
    }

    // Fill in history entries for solved days whose record pre-dates
    // the history feature. If streak is N and last_win_date is D, then
    // D, D-1, ..., D-(N-1) were all wins in a row; any of those days
    // that has no history entry is tagged as solved so the calendar
    // matches the streak count.
    backfill_daily_history(s) {
	if (!s || !s.daily || !s.daily.last_win_date || !s.daily.streak) return;
	s.daily.history = s.daily.history || {};
	const last = new Date(`${s.daily.last_win_date}T12:00:00Z`);
	for (let i = 0; i < s.daily.streak; i++) {
	    const day = new Date(last);
	    day.setUTCDate(day.getUTCDate() - i);
	    const iso = `${day.getUTCFullYear()}-${String(day.getUTCMonth()+1).padStart(2,'0')}-${String(day.getUTCDate()).padStart(2,'0')}`;
	    if (!s.daily.history[iso]) s.daily.history[iso] = { result: 'solved' };
	}
    }

    save_stats() {
	try { localStorage.setItem(this.STATS_KEY(), JSON.stringify(this.stats)); } catch (e) {}
	this.save_stats_remote();   // no-op when signed out
    }

    // ---- Google sign-in / Firestore sync ----
    // While signed in, the Firestore document is the source of truth:
    // every save_stats writes to it, every sign-in pulls it down and
    // OVERWRITES local. Signing out reverts to the local cache.
    init_auth() {
	if (!window.WG_AUTH) return;  // Firebase init failed / placeholder config
	const A = window.WG_AUTH;
	A.onAuthStateChanged(A.auth, async (user) => {
	    const was = this.auth_user;
	    this.auth_user = user || null;
	    if (user && (!was || was.uid !== user.uid)) {
		// Just signed in: pull remote and overwrite local.
		try {
		    const snap = await A.getDoc(A.doc(A.db, "stats", user.uid));
		    const remote = snap.exists() ? snap.data() : null;
		    this.stats = remote && remote.daily ? remote : this.default_stats();
		    // Derive any pre-history solved days from streak so the
		    // calendar matches the reported streak count.
		    const before = JSON.stringify(this.stats.daily && this.stats.daily.history || {});
		    this.backfill_daily_history(this.stats);
		    const after = JSON.stringify(this.stats.daily.history || {});
		    try { localStorage.setItem(this.STATS_KEY(), JSON.stringify(this.stats)); } catch (e) {}
		    if (!remote) this.save_stats_remote();   // seed empty doc
		    else if (before !== after) this.save_stats_remote();   // persist backfill
		    // If we're currently showing the daily puzzle, re-apply
		    // today's state from the freshly-synced stats doc. This
		    // catches the case where local storage was wiped / is out
		    // of date but Firestore has today's result.
		    if (this.mode === 'daily') {
			const s = this.load_daily_state() || this.synth_daily_from_history();
			if (s) this.apply_daily_state(s);
		    }
		    // If today's daily was finished before the World tab
		    // existed, contribute now so the totals match.
		    this.backfill_aggregate_for_today();
		} catch (e) { console.warn("remote stats fetch failed:", e); }
	    } else if (!user && was) {
		// Just signed out: reload whatever is in localStorage.
		this.stats = this.load_stats();
	    }
	    if (this.stats_modal_state) this.refresh_stats_modal();
	});
    }

    save_stats_remote() {
	if (!this.auth_user || !window.WG_AUTH) return;
	// Debounce: coalesce bursts (post-win complaint clicks, rapid
	// move sequences) into one write per ~1.2s, well above the
	// Firestore rule's 1s/user throttle.
	if (this._save_remote_pending) return;
	this._save_remote_pending = true;
	setTimeout(() => {
	    this._save_remote_pending = false;
	    if (!this.auth_user || !window.WG_AUTH) return;
	    const A = window.WG_AUTH;
	    try {
		const payload = Object.assign({}, this.stats, { last_write: A.serverTimestamp() });
		A.setDoc(A.doc(A.db, "stats", this.auth_user.uid), payload);
	    } catch (e) {}
	}, 1200);
    }

    // ---- Shared per-day aggregate stats (the "World" tab) ----
    // One Firestore document per daily puzzle at aggregates/{iso_date},
    // shape:
    //   { date, puzzle_number, start, goal, ideal,
    //     distribution: { "0": n, "1": n, ..., "5plus": n, "giveup": n },
    //     total_plays: N, last_updated: timestamp }
    // Every completing signed-in player atomically increments the bucket
    // for their outcome + total_plays once per puzzle; the 'contributed'
    // flag on their own history entry prevents double-counting.

    _outcome_bucket(won, over) {
	if (!won) return 'giveup';
	const o = Math.max(0, over | 0);
	return o >= 5 ? '5plus' : String(o);
    }

    async contribute_to_aggregate(won, over) {
	if (this.archive_date) return;                   // archive plays are isolated
	if (!this.auth_user || !window.WG_AUTH) return;  // anonymous can't write
	if (!this.stats || !this.stats.daily) return;
	const today = this.iso_today();
	this.stats.daily.history = this.stats.daily.history || {};
	const hist = this.stats.daily.history[today];
	if (hist && hist.aggregate_contributed) return;

	const A = window.WG_AUTH;
	const ideal = (this.word_path && this.word_path.length > 0)
	      ? this.word_path.length - 1
	      : (hist && hist.ideal) || 0;
	const bucket = this._outcome_bucket(won, over);

	const ref = A.doc(A.db, "aggregates", today);
	try {
	    await A.setDoc(ref, {
		date: today,
		puzzle_number: this.daily_puzzle_number(today),
		start: this.daily_start,
		goal: this.daily_goal,
		ideal: ideal,
		distribution: { [bucket]: A.increment(1) },
		total_plays: A.increment(1),
		last_updated: A.serverTimestamp(),
	    }, { merge: true });
	    if (hist) hist.aggregate_contributed = true;
	    this.save_stats();   // persist the flag locally + remotely
	    // Invalidate the World-tab cache so a fresh fetch includes
	    // this play the next time the tab is opened.
	    this._world_cache = null;
	} catch (e) { console.warn("aggregate write failed:", e); }
    }

    // Catch up the aggregates doc for today if the player completed
    // this puzzle before the World tab existed (or in a previous
    // session that never wrote). Safe to call repeatedly; no-op once
    // the history entry has aggregate_contributed set.
    async backfill_aggregate_for_today() {
	if (this.archive_date) return;
	if (!this.auth_user || !window.WG_AUTH) return;
	if (!this.stats || !this.stats.daily || !this.stats.daily.history) return;
	const today = this.iso_today();
	const h = this.stats.daily.history[today];
	if (!h) return;                         // didn't play today
	if (h.aggregate_contributed) return;    // already counted
	if (h.result !== 'solved' && h.result !== 'gave_up') return;
	const won = h.result === 'solved';
	const over = won && (h.steps != null && h.ideal != null)
	      ? Math.max(0, h.steps - h.ideal)
	      : 0;
	// contribute_to_aggregate rereads the flag and writes once.
	await this.contribute_to_aggregate(won, over);
    }

    // Return today's daily state even if the currently-loaded game is
    // an archived date. Consulted by the Daily tab of the stats modal
    // so its subtitle and row highlight reflect today's puzzle — not
    // whichever past daily the player is looking at via the calendar.
    get_today_daily_state() {
	const today_iso = this.iso_today();
	// Live state, only when the actual current game is today's daily.
	if (this.mode === 'daily' && !this.archive_date) {
	    const ideal = (this.word_path && this.word_path.length > 0)
		  ? this.word_path.length - 1 : null;
	    return {
		ended: this.game_over(),
		victory: !!this.VICTORY,
		gave_up: !!this.GAVE_UP,
		count: this.count,
		ideal: ideal,
	    };
	}
	// Otherwise reconstruct today's state from the stats doc.
	const compute_ideal = () => {
	    const entry = this.lookup_daily_for_date(today_iso);
	    if (!entry) return null;
	    const p = calc_word_path(entry.start, entry.goal, this.word_array, this.word_graph);
	    return (p && p.length > 0) ? p.length - 1 : null;
	};
	const cur = this.stats && this.stats.daily && this.stats.daily.current;
	if (cur && cur.date === today_iso) {
	    return {
		ended: !!(cur.victory || cur.gave_up),
		victory: !!cur.victory,
		gave_up: !!cur.gave_up,
		count: cur.count || 0,
		ideal: compute_ideal(),
	    };
	}
	const h = this.stats && this.stats.daily && this.stats.daily.history
		&& this.stats.daily.history[today_iso];
	if (h) {
	    return {
		ended: (h.result === 'solved' || h.result === 'gave_up'),
		victory: h.result === 'solved',
		gave_up: h.result === 'gave_up',
		count: h.steps || 0,
		ideal: (h.ideal != null ? h.ideal : compute_ideal()),
	    };
	}
	return { ended: false, victory: false, gave_up: false, count: 0, ideal: compute_ideal() };
    }

    async fetch_world_stats(iso_date) {
	if (!window.WG_AUTH) return null;
	const A = window.WG_AUTH;
	try {
	    const snap = await A.getDoc(A.doc(A.db, "aggregates", iso_date));
	    return snap.exists() ? snap.data() : null;
	} catch (e) { return null; }
    }

    sign_in_google() {
	if (!window.WG_AUTH) return;
	const A = window.WG_AUTH;
	A.signInWithPopup(A.auth, A.provider).catch(e => console.warn("sign-in failed:", e));
    }

    sign_out() {
	if (!window.WG_AUTH) return;
	const A = window.WG_AUTH;
	A.signOut(A.auth).catch(e => console.warn("sign-out failed:", e));
    }

    refresh_stats_modal() {
	const s = this.stats_modal_state;
	if (!s) return;
	if (s.container && !s.container.__closed) s.container.destroy();
	this.show_stats_modal(s.mode, s.won, s.tab);
    }

    iso_today() {
	const p = this.et_today_parts();
	return `${p.year}-${p.month}-${p.day}`;
    }

    iso_yesterday() {
	// Subtract one calendar day from the ET date. Anchor at noon UTC
	// of the ET date so DST shifts can't bump us across a boundary.
	const p = this.et_today_parts();
	const d = new Date(`${p.year}-${p.month}-${p.day}T12:00:00Z`);
	d.setUTCDate(d.getUTCDate() - 1);
	const yyyy = d.getUTCFullYear();
	const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
	const dd = String(d.getUTCDate()).padStart(2, '0');
	return `${yyyy}-${mm}-${dd}`;
    }

    // Did today's daily end (won or gave up)? Looks in the same order
    // load_daily_state does: stats.daily.current (Firestore-synced),
    // then stats.daily.history, then the per-day localStorage key.
    daily_ended_today() {
	const today = this.iso_today();
	const sd = this.stats && this.stats.daily;
	if (sd && sd.current && sd.current.date === today
		&& (sd.current.victory || sd.current.gave_up)) return true;
	if (sd && sd.history && sd.history[today]
		&& (sd.history[today].result === 'solved'
		 || sd.history[today].result === 'gave_up')) return true;
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
	    st.history = st.history || {};
	    const ideal = (this.word_path && this.word_path.length > 0) ? this.word_path.length - 1 : null;
	    st.history[today] = {
		result: 'solved', steps: this.count, ideal: ideal,
		words: this.daily_history_words(),
	    };
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
	if (mode === 'daily') {
	    st.history = st.history || {};
	    const today = this.iso_today();
	    const ideal = (this.word_path && this.word_path.length > 0) ? this.word_path.length - 1 : null;
	    st.history[today] = {
		result: 'gave_up', ideal: ideal,
		words: this.daily_history_words(),
	    };
	}
	this.save_stats();
    }

    // Record a late solve via the archive. Only writes when there's no
    // prior entry for the date — a missed day. Real on-day results are
    // never overwritten. Late solves don't affect streak / distribution
    // / world aggregates; they only mark the calendar cell as yellow
    // and stash the winning chain so it can be re-read later.
    record_archive_solve() {
	if (!this.archive_date) return;
	if (!this.stats) this.stats = this.default_stats();
	if (!this.stats.daily) this.stats.daily = {};
	const st = this.stats.daily;
	st.history = st.history || {};
	if (st.history[this.archive_date]) return;
	const ideal = (this.word_path && this.word_path.length > 0) ? this.word_path.length - 1 : null;
	st.history[this.archive_date] = {
	    result: 'solved_late', steps: this.count, ideal: ideal,
	    words: this.daily_history_words(),
	};
	this.save_stats();
    }

    // Pop the last guess off the chain. No-op on a finished game,
    // mid-freeplay-setup (no chain yet), or when only the start word
    // remains. Mirrors save_current_state() so localStorage and the
    // remote stats doc stay in sync with the on-screen chain.
    undo_last_word() {
	if (this.game_over()) return;
	if (this.freeplay_stage !== FREEPLAY_STAGES["none"]) return;
	// Mobile taps can register 2–3 times in the ~200ms it takes the
	// finger to lift; debounce so one tap = one pop.
	if (this.undo_lockout_until && Date.now() < this.undo_lockout_until) return;
	this.undo_lockout_until = Date.now() + 350;
	const lines = (this.word_history.text || "").split('\n');
	if (lines.length <= 1) return;
	lines.pop();
	this.word_history.setText(lines.join('\n'));
	if (this.word_history.displayHeight > HISTORY_BOX_H)
	    this.word_history.y = HISTORY_BOX_Y + HISTORY_BOX_H - this.word_history.displayHeight;
	else
	    this.word_history.y = HISTORY_BOX_Y;
	this.count = Math.max(0, this.count - 1);
	this.score_counter.setText(String(this.count));
	const last = lines[lines.length - 1] || "";
	const m = last.match(/^>\s*(.*)$/);
	this.current_word = (m && m[1]) ? m[1] : this.start_word.toUpperCase();
	this.set_prompts_visible(true);
	this.save_current_state();
    }

    // Show or hide the start/goal prompt labels. We hide them while a
    // long easter-egg complaint string is displayed in the score slot
    // so the wrap-around text doesn't visually crash into the prompts.
    set_prompts_visible(visible) {
	if (this.prev_word) this.prev_word.setVisible(visible);
	if (this.goal_word) this.goal_word.setVisible(visible);
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
	if (this.ideal_history) { this.ideal_history.setText(""); this.ideal_history.y = HISTORY_BOX_Y; }
	this.set_prompts_visible(true);
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
	if (!this.word_path || this.word_path.length === 0) return;
	const lines = this.word_path.map(w => "> " + w.toUpperCase()).join("\n");
	this.ideal_history.setText(lines);
	this.ideal_history.x = HISTORY_BOX_X + HISTORY_BOX_W;
	this.ideal_history.y = HISTORY_BOX_Y;
	if (this.ideal_history.displayHeight > HISTORY_BOX_H)
	    this.ideal_history.y = HISTORY_BOX_Y + HISTORY_BOX_H - this.ideal_history.displayHeight;
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
	// Archived daily already won/lost: board is view-only.
	if (this.archive_date && this.game_over()) {
	    this.input_box.getChildByName("input_word").value = "";
	    return;
	}
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
	    // Complaints can run wide enough to overlap the start/goal
	    // labels — hide those while a complaint is in the score slot.
	    this.set_prompts_visible(false);
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
		this.show_solution();   // also display the ideal in the right column
		if (!this.stats_recorded && (this.mode === 'daily' || this.mode === 'practice')
			&& !this.archive_date) {
		    const over = Math.max(0, this.count - ideal_steps);
		    this.record_win(this.mode, over);
		    this.stats_recorded = true;
		    if (this.mode === 'daily') this.contribute_to_aggregate(true, over);
		    this.show_stats_modal(this.mode, true);
		} else if (this.archive_date && !this.stats_recorded) {
		    // Late-solve via the calendar archive: mark the cell yellow
		    // and persist the player's chain, but don't touch streak,
		    // distribution, or world aggregates.
		    this.record_archive_solve();
		    this.stats_recorded = true;
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
	// Right-hand column for the ideal solution (filled in by
	// show_solution; rendered green and aligned to the right edge of
	// the history box).
	this.ideal_history = this.add_text(HISTORY_BOX_X + HISTORY_BOX_W, HISTORY_BOX_Y, "", HISTORY_BOX_FONTSIZE, COLOR_GREEN);
	this.ideal_history.setOrigin(1, 0);
	// Archive mode indicator, shown only while playing a past daily
	// from the calendar tab. Positioned just below the history box.
	this.archive_label = this.add_text(WINDOW_WIDTH / 2, HISTORY_BOX_Y + HISTORY_BOX_H + 10, "", 12, COLOR_MUTED);
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
	
	// Add scroll panel for word_history (and the matching ideal column).
	var graphics = this.make.graphics();
	graphics.fillRect(HISTORY_BOX_X, HISTORY_BOX_Y, HISTORY_BOX_W, HISTORY_BOX_H);
	var history_mask = new Phaser.Display.Masks.GeometryMask(this, graphics);
	this.word_history.setMask(history_mask);
	this.ideal_history.setMask(history_mask);
	var history_zone = this.add.zone(HISTORY_BOX_X, HISTORY_BOX_Y, HISTORY_BOX_W, HISTORY_BOX_H).setOrigin(0).setInteractive();
	history_zone.on('wheel', function (pointer) {
	    const tallest = Math.max(this.word_history.displayHeight, this.ideal_history.displayHeight);
	    if (tallest > HISTORY_BOX_H) {
		const dy = pointer.deltaY / 5;
		const min_y = HISTORY_BOX_Y + HISTORY_BOX_H - tallest;
		this.word_history.y = Phaser.Math.Clamp(this.word_history.y - dy, min_y, HISTORY_BOX_Y);
		this.ideal_history.y = Phaser.Math.Clamp(this.ideal_history.y - dy, min_y, HISTORY_BOX_Y);
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

	// UNDO sits immediately to the right of RESET. Pops the last word
	// off the chain instead of nuking it back to the start, so a
	// mis-typed letter doesn't cost the whole run. The button uses a
	// wider padding than RESET so we offset by gap + its own padding
	// to keep the boxes from overlapping.
	const UNDO_APX = APX + 4;
	const undo_x = this.reset.zone.x + this.reset.zone.width + 8 + UNDO_APX;
	this.undo = this.add_button(undo_x, RESET_Y, "↑", ACTION_FONTSIZE, COLOR_RED, 0, 0, UNDO_APX, APY);
	this.undo.zone.on('pointerdown', () => this.undo_last_word());

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
	this.rules_button.zone.on('pointerdown', () => this.rules_modal.show());

	this.load_gamemodes();
    }

    // Render a 42-cell daily-calendar grid (6 rows x 7 cols), anchored
    // so today sits in its natural weekday column of the bottom row.
    // Green = solved, red = gave-up, muted = not played; today gets a
    // blue outline.
    _render_calendar_tab(items, bx, bw, y0, greenColor, redColor, mutedColor, close_modal) {
	const yellowColor = Phaser.Display.Color.HexStringToColor(COLOR_YELLOW).color;
	const cell = 32;
	const gap  = 4;
	const cols = 7;
	const rows = 6;
	const grid_w = cols * cell + (cols - 1) * gap;
	const grid_x = bx + (bw - grid_w) / 2;

	// Weekday header (S M T W T F S, Sun-first).
	const days = ['S','M','T','W','T','F','S'];
	for (let c = 0; c < cols; c++) {
	    const cx = grid_x + c * (cell + gap) + cell / 2;
	    const h = this.add.text(cx, y0, days[c],
				    { fontSize: 11, fontFamily: "'Inter', sans-serif", color: COLOR_MUTED })
		  .setOrigin(0.5, 0).setResolution(RESOLUTION);
	    items.push(h);
	}

	const history = (this.stats && this.stats.daily && this.stats.daily.history) || {};
	const today_iso = this.iso_today();
	const et = this.et_today_parts();
	const today_utc = new Date(`${et.year}-${et.month}-${et.day}T12:00:00Z`);
	const today_dow = today_utc.getUTCDay();                // 0=Sun..6=Sat
	const cells_total = rows * cols;
	// Position of today in the grid: last-row + today's weekday column.
	const today_slot = (rows - 1) * cols + today_dow;

	const blueColor = Phaser.Display.Color.HexStringToColor(COLOR_BLUE).color;
	const grid_y = y0 + 20;
	for (let i = 0; i < cells_total; i++) {
	    const col = i % cols;
	    const row = Math.floor(i / cols);
	    const cx = grid_x + col * (cell + gap);
	    const cy = grid_y + row * (cell + gap);

	    const offset = i - today_slot;           // +1 = tomorrow, -1 = yesterday
	    const d = new Date(today_utc);
	    d.setUTCDate(d.getUTCDate() + offset);
	    const yyyy = d.getUTCFullYear();
	    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
	    const dd = String(d.getUTCDate()).padStart(2, '0');
	    const iso = `${yyyy}-${mm}-${dd}`;

	    const h = history[iso];
	    const is_today  = (iso === today_iso);
	    const is_future = (offset > 0);

	    const g = this.add.graphics();
	    let fill_color, fill_alpha;
	    if (h && h.result === 'solved')              { fill_color = greenColor;  fill_alpha = 0.85; }
	    else if (h && h.result === 'gave_up')        { fill_color = redColor;    fill_alpha = 0.85; }
	    else if (h && h.result === 'solved_late')    { fill_color = yellowColor; fill_alpha = 0.85; }
	    else if (h && h.result === 'gave_up_late')   { fill_color = yellowColor; fill_alpha = 0.85; }
	    else if (is_future)                           { fill_color = mutedColor; fill_alpha = 0.08; }
	    else                                          { fill_color = mutedColor; fill_alpha = 0.25; }
	    g.fillStyle(fill_color, fill_alpha).fillRoundedRect(cx, cy, cell, cell, 5);
	    if (is_today) {
		g.lineStyle(1.8, blueColor, 0.95).strokeRoundedRect(cx, cy, cell, cell, 5);
	    }
	    items.push(g);

	    // Day-of-month label in-cell so the grid reads as a calendar.
	    const label = this.add.text(cx + cell / 2, cy + cell / 2, String(d.getUTCDate()),
					{ fontSize: 10, fontFamily: "'Inter', sans-serif",
					  color: (h ? COLOR_BG : COLOR_MUTED),
					  fontStyle: is_today ? "600" : "400" })
		  .setOrigin(0.5, 0.5).setResolution(RESOLUTION);
	    items.push(label);

	    // Clickable: any past date that has a puzzle in the daily list
	    // (also today; tapping today just re-loads today's daily).
	    // Future cells stay inert.
	    if (!is_future && close_modal) {
		const entry = this.lookup_daily_for_date(iso);
		if (entry) {
		    const zone = this.add.zone(cx, cy, cell, cell).setOrigin(0, 0).setInteractive();
		    zone.on('pointerdown', () => {
			close_modal();
			if (iso === today_iso) {
			    // tapping today exits archive and loads today.
			    this.exit_archive();
			    this.start_word = this.daily_start;
			    this.goal_word.setText(this.daily_goal);
			    this.word_path = calc_word_path(this.start_word, this.goal_word.text,
							    this.word_array, this.word_graph);
			    this.set_active_mode('daily');
			    this.update_solution_button();
			    const saved = this.load_daily_state() || this.synth_daily_from_history();
			    if (saved) this.apply_daily_state(saved);
			    else this.reset_game_state();
			} else {
			    this.enter_archive(iso);
			}
		    });
		    items.push(zone);
		}
	    }
	}

	// Legend: coloured bullet for each result category. Lay the three
	// "● label" pairs out left-to-right and centre the whole strip.
	const legend_y = grid_y + rows * (cell + gap) + 12;
	const legend_parts = [
	    { dot: COLOR_GREEN,  label: 'solved' },
	    { dot: COLOR_RED,    label: 'gave up' },
	    { dot: COLOR_YELLOW, label: 'late'    },
	    { dot: COLOR_MUTED,  label: 'not played' },
	];
	const make_measure = (text, color) => this.add.text(0, 0, text,
	    { fontSize: 11, fontFamily: "'Inter', sans-serif", color: color });
	// Probe widths so we can centre the assembly.
	const pairs = legend_parts.map(p => {
	    const dotProbe = make_measure('●', p.dot).setResolution(RESOLUTION);
	    const lblProbe = make_measure(' ' + p.label, COLOR_MUTED).setResolution(RESOLUTION);
	    const dw = dotProbe.width, lw = lblProbe.width;
	    dotProbe.destroy(); lblProbe.destroy();
	    return { p, dw, lw };
	});
	const gap_between = 14;
	const total_w = pairs.reduce((s, o) => s + o.dw + o.lw, 0)
			+ gap_between * (pairs.length - 1);
	let px = WINDOW_WIDTH / 2 - total_w / 2;
	for (const o of pairs) {
	    const dot = this.add.text(px, legend_y, '●',
		{ fontSize: 11, fontFamily: "'Inter', sans-serif", color: o.p.dot })
		  .setOrigin(0, 0).setResolution(RESOLUTION);
	    const lbl = this.add.text(px + o.dw, legend_y, ' ' + o.p.label,
		{ fontSize: 11, fontFamily: "'Inter', sans-serif", color: COLOR_MUTED })
		  .setOrigin(0, 0).setResolution(RESOLUTION);
	    items.push(dot, lbl);
	    px += o.dw + o.lw + gap_between;
	}
    }

    // World tab: renders the aggregate distribution for today's daily
    // (or the archived date, if one is active). Uses a small in-memory
    // cache so reopening the tab doesn't re-hit Firestore.
    _render_world_tab(items, bx, bw, y0, greenColor, redColor, mutedColor) {
	const date = this.archive_date || this.iso_today();
	const cache = this._world_cache;
	if (!cache || cache.date !== date) {
	    // Show loading + kick off fetch.
	    const loading = this.add.text(WINDOW_WIDTH / 2, y0 + 40,
					  "Loading world results…",
					  { fontSize: 14, fontFamily: "'Inter', sans-serif",
					    color: COLOR_MUTED })
		  .setOrigin(0.5, 0).setResolution(RESOLUTION);
	    items.push(loading);
	    this._world_cache = { date, data: undefined };
	    this.fetch_world_stats(date).then(data => {
		this._world_cache = { date, data };
		// If still on the World tab, rebuild with the data.
		if (this.stats_modal_state && this.stats_modal_state.tab === 'world'
			&& !this.stats_modal_state.container.__closed) {
		    this.refresh_stats_modal();
		}
	    });
	    return;
	}
	if (cache.data === undefined) {
	    // Fetch in flight from a previous open; show loading again.
	    const loading = this.add.text(WINDOW_WIDTH / 2, y0 + 40,
					  "Loading world results…",
					  { fontSize: 14, fontFamily: "'Inter', sans-serif",
					    color: COLOR_MUTED })
		  .setOrigin(0.5, 0).setResolution(RESOLUTION);
	    items.push(loading);
	    return;
	}
	if (!cache.data) {
	    const note = (date === this.iso_today())
		  ? "No world results yet today."
		  : "No world results for this date.";
	    const t1 = this.add.text(WINDOW_WIDTH / 2, y0 + 40, note,
				     { fontSize: 14, fontFamily: "'Inter', sans-serif",
				       color: COLOR_MUTED })
		  .setOrigin(0.5, 0).setResolution(RESOLUTION);
	    const t2 = !this.auth_user
		  ? this.add.text(WINDOW_WIDTH / 2, y0 + 68,
				  "(Sign in to record and see world stats.)",
				  { fontSize: 11, fontFamily: "'Inter', sans-serif",
				    color: COLOR_MUTED })
			.setOrigin(0.5, 0).setResolution(RESOLUTION)
		  : null;
	    items.push(t1); if (t2) items.push(t2);
	    return;
	}

	// Render aggregate distribution bars (same rows as the personal
	// distribution tab, scaled against the largest bucket).
	const data = cache.data;
	const dist = data.distribution || {};
	const rows = [
	    { label: 'Ideal',   count: +dist['0']       || 0, color: greenColor },
	    { label: '1',       count: +dist['1']       || 0, color: greenColor },
	    { label: '2',       count: +dist['2']       || 0, color: greenColor },
	    { label: '3',       count: +dist['3']       || 0, color: greenColor },
	    { label: '4',       count: +dist['4']       || 0, color: greenColor },
	    { label: '5+',      count: +dist['5plus']   || 0, color: greenColor },
	    { label: 'Gave Up', count: +dist['giveup']  || 0, color: redColor   },
	];
	const total = +data.total_plays || rows.reduce((s, r) => s + r.count, 0);
	const plays_word = (total === 1) ? 'play' : 'plays';

	const header = this.add.text(WINDOW_WIDTH / 2, y0,
				     `${(data.start || '?').toUpperCase()} → ${(data.goal || '?').toUpperCase()}   ·   ideal ${data.ideal || '?'}   ·   ${total} ${plays_word} today`,
				     { fontSize: 13, fontFamily: "'Inter', sans-serif", color: COLOR_TEXT })
	      .setOrigin(0.5, 0).setResolution(RESOLUTION);
	items.push(header);

	// Shift the bar column left and push the count/percent column
	// further right so the worm body never overlaps the readout
	// (the worm can extend past bar_end_x by its rounded cap).
	const bar_x = bx + 80;
	const bar_end_x = bx + bw - 115;
	const bar_w_full = bar_end_x - bar_x;
	const count_col_x = bx + bw - 18;
	const bar_h = 18;
	const row_gap = 28;
	const rows_start_y = y0 + 36;
	const label_right_x = bar_x - 10;
	const max_count = Math.max(1, ...rows.map(r => r.count));

	const draw_worm = (g, x, y, w, h, color_int) => {
	    if (w <= 0) return;
	    g.fillStyle(color_int, 0.95);
	    g.fillRoundedRect(x, y, w, h, h / 2);
	    const cap = h / 2;
	    const rib_start = x + cap + 4;
	    const rib_end = x + w - cap - 4;
	    g.lineStyle(1.2, 0x000000, 0.28);
	    for (let rx = rib_start; rx <= rib_end; rx += 22) {
		g.beginPath();
		g.moveTo(rx, y + 2); g.lineTo(rx, y + h - 2); g.strokePath();
	    }
	};

	for (let i = 0; i < rows.length; i++) {
	    const r = rows[i];
	    const row_y = rows_start_y + i * row_gap;
	    const label = this.add.text(label_right_x, row_y + bar_h / 2, r.label,
					{ fontSize: 13, fontFamily: "'Inter', sans-serif", color: COLOR_TEXT })
		  .setOrigin(1, 0.5).setResolution(RESOLUTION);
	    const bar = this.add.graphics();
	    bar.fillStyle(mutedColor, 0.20).fillRoundedRect(bar_x, row_y, bar_w_full, bar_h, bar_h / 2);
	    if (r.count > 0) {
		const fw = (r.count / max_count) * bar_w_full;
		draw_worm(bar, bar_x, row_y, fw, bar_h, r.color);
	    }
	    const pct = total ? Math.round((r.count / total) * 100) : 0;
	    const count_txt = `${r.count} · ${pct}%`;
	    const count = this.add.text(count_col_x, row_y + bar_h / 2, count_txt,
					{ fontSize: 12, fontFamily: "'Inter', sans-serif", color: COLOR_TEXT })
		  .setOrigin(1, 0.5).setResolution(RESOLUTION);
	    items.push(label, bar, count);
	}
    }

    // Copy today's daily result to the clipboard in a short shareable
    // form. Returns true on success, false on failure (e.g. browser
    // blocks clipboard access outside of a gesture).
    async share_result() {
	if (this.mode !== 'daily' && !(this.stats && this.stats.daily
	    && this.stats.daily.current
	    && this.stats.daily.current.date === this.iso_today())) return false;
	const n = this.daily_puzzle_number();
	const cur = (this.stats && this.stats.daily && this.stats.daily.current) || {};
	const won = !!(this.VICTORY || cur.victory);
	const gave = !!(this.GAVE_UP || cur.gave_up);
	const ideal = (this.word_path && this.word_path.length > 0)
	      ? this.word_path.length - 1
	      : (this.stats && this.stats.daily && this.stats.daily.history
		 && this.stats.daily.history[this.iso_today()]
		 && this.stats.daily.history[this.iso_today()].ideal) || null;
	const steps = (this.count > 0) ? this.count : (cur.count || 0);

	const start_word = (this.daily_start || (cur.start || '??')).toUpperCase();
	const goal_word  = (this.daily_goal  || (cur.goal  || '??')).toUpperCase();

	let header;
	if (won) {
	    const over = (ideal !== null) ? Math.max(0, steps - ideal) : 0;
	    header = `Worm Game #${n} — ${steps}/${ideal || '?'}` + (over ? ` (+${over})` : '');
	} else if (gave) {
	    header = `Worm Game #${n} — gave up`;
	} else {
	    return false;
	}
	const pair = `${start_word} → ${goal_word}`;
	const emoji = gave ? '🔴' : '🟢';
	const body_len = won ? steps : (ideal || 1);
	const grid = emoji.repeat(Math.max(1, body_len));
	const url = 'https://soft-shade.github.io/worm-game/';
	const text = `${header}\n${pair}\n${grid}\n${url}`;

	try {
	    if (navigator.clipboard && navigator.clipboard.writeText) {
		await navigator.clipboard.writeText(text);
		return true;
	    }
	    // Fallback: textarea + execCommand (older browsers / http contexts).
	    const ta = document.createElement('textarea');
	    ta.value = text; ta.style.position = 'fixed'; ta.style.top = '-1000px';
	    document.body.appendChild(ta); ta.select();
	    const ok = document.execCommand('copy');
	    document.body.removeChild(ta);
	    return ok;
	} catch (e) { return false; }
    }

    // Build + show a dismissible stats overlay. `mode` identifies the
    // game-mode context (the caller's current game) so highlights /
    // subtitles can show the just-finished result. `tab` picks which
    // view is rendered: 'daily' / 'practice' (distribution bars for
    // that mode) or 'calendar' (per-day daily-history grid).
    show_stats_modal(mode, won, tab) {
	if (!tab) tab = (mode === 'practice') ? 'practice' : 'daily';
	// Which stats bucket to render (only for bar-view tabs).
	const stats_key = (tab === 'practice') ? 'practice' : 'daily';
	const st = this.stats[stats_key];
	const container = this.add.container(0, 0).setDepth(1000);
	const bgColor = Phaser.Display.Color.HexStringToColor(COLOR_BG).color;
	const backdrop = this.add.rectangle(0, 0, WINDOW_WIDTH, WINDOW_HEIGHT, bgColor, 1)
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

	const items = [backdrop, panel, header];

	// Close (X) button at the top-right of the panel. The visual
	// glyph is small but a 44x44 zone behind it gives a thumb-sized
	// tap target.
	const close_cx = bx + bw - 20, close_cy = by + 22;
	const close_x = this.add.text(close_cx, close_cy, "×",
				      { fontSize: 26, fontFamily: "'Inter', sans-serif",
					color: COLOR_MUTED, fontStyle: "600" })
	      .setOrigin(0.5, 0.5).setResolution(RESOLUTION);
	const close_zone = this.add.zone(close_cx - 22, close_cy - 22, 44, 44)
	      .setOrigin(0, 0).setInteractive();
	close_zone.on('pointerover', () => close_x.setColor(COLOR_TEXT));
	close_zone.on('pointerout',  () => close_x.setColor(COLOR_MUTED));
	close_zone.on('pointerdown', () => close(false));
	items.push(close_x, close_zone);

	// Result subtitle. The Daily tab always describes TODAY's daily,
	// even if an archived puzzle is currently loaded in the game. The
	// Unlimited tab uses the live practice state when that's the
	// current mode. Other tabs (calendar/world) skip the subtitle.
	const live_ended = this.game_over();
	const live_ideal = (this.word_path && this.word_path.length > 0)
	      ? this.word_path.length - 1 : null;
	let sub_ended = false, sub_victory = false, sub_gaveup = false,
	    sub_count = 0, sub_ideal = null, sub_label = null;
	if (tab === 'daily') {
	    const s = this.get_today_daily_state();
	    sub_ended = s.ended; sub_victory = s.victory; sub_gaveup = s.gave_up;
	    sub_count = s.count; sub_ideal = s.ideal;
	    sub_label = `DAILY PUZZLE #${this.daily_puzzle_number()}`;
	} else if (tab === 'practice' && mode === 'practice') {
	    sub_ended = live_ended; sub_victory = this.VICTORY; sub_gaveup = this.GAVE_UP;
	    sub_count = this.count; sub_ideal = live_ideal;
	    sub_label = 'UNLIMITED';
	}
	if (sub_label) {
	    let main_str = sub_label;
	    if (sub_ended && sub_victory) main_str = `${sub_label} — SOLVED (${sub_count} steps)`;
	    else if (sub_ended && sub_gaveup) main_str = `${sub_label} — GAVE UP`;
	    const subtitle = this.add.text(WINDOW_WIDTH / 2, by + 64, main_str,
					   { fontSize: 17, fontFamily: "'Inter', sans-serif",
					     color: (sub_ended && !sub_victory) ? COLOR_RED
						 : (sub_ended ? COLOR_GREEN : COLOR_TEXT),
					     fontStyle: "600" })
		  .setOrigin(0.5, 0).setResolution(RESOLUTION);
	    items.push(subtitle);
	    if (sub_ended && sub_ideal !== null) {
		const ideal_line = this.add.text(WINDOW_WIDTH / 2, by + 88,
						 `Ideal Solution (${sub_ideal} steps)`,
						 { fontSize: 13, fontFamily: "'Inter', sans-serif",
						   color: COLOR_TEXT })
		      .setOrigin(0.5, 0).setResolution(RESOLUTION);
		items.push(ideal_line);
	    }
	}
	// Kept for the distribution-bar highlight below.
	const ended = live_ended;
	const ideal_steps = live_ideal;

	// ---- Tab bar ----
	const tab_y = by + 120;
	// Tab order: Unlimited / Daily / World / Calendar. Four tabs
	// means none sits perfectly centred; spacing + smaller labels
	// keep them all inside the modal.
	const tab_defs = [
	    { id: 'practice',  label: 'UNLIMITED' },
	    { id: 'daily',     label: 'DAILY'     },
	    { id: 'world',     label: 'WORLD'     },
	    { id: 'calendar',  label: 'CALENDAR'  },
	];
	// Space tabs across the panel. Four tabs fit with ~70 px between
	// centres; labels use a slightly smaller font for clarity.
	const tab_spacing = (bw - 40) / tab_defs.length;
	const tab_first_x = bx + 20 + tab_spacing / 2;
	tab_defs.forEach((t, i) => {
	    const tx = tab_first_x + i * tab_spacing;
	    const is_active = (t.id === tab);
	    const txt = this.add.text(tx, tab_y, t.label,
				      { fontSize: 12, fontFamily: "'Inter', sans-serif",
					color: is_active ? COLOR_GREEN : COLOR_MUTED,
					fontStyle: is_active ? "600" : "400" })
		  .setOrigin(0.5, 0.5).setResolution(RESOLUTION);
	    items.push(txt);
	    if (is_active) {
		const underline = this.add.graphics();
		const ulc = Phaser.Display.Color.HexStringToColor(COLOR_GREEN).color;
		underline.fillStyle(ulc, 0.9).fillRect(tx - 22, tab_y + 10, 44, 2);
		items.push(underline);
	    } else {
		txt.setInteractive();
		txt.on('pointerdown', () => {
		    close(false);
		    this.show_stats_modal(mode, won, t.id);
		});
	    }
	});

	const content_y = by + 142;

	// ---- Tab content ----
	if (tab === 'calendar') {
	    this._render_calendar_tab(items, bx, bw, content_y,
				      greenColor, redColor, mutedColor,
				      () => close(false));
	} else if (tab === 'world') {
	    this._render_world_tab(items, bx, bw, content_y,
				   greenColor, redColor, mutedColor);
	} else {
	    // Distribution bars for the 'daily' / 'practice' stats bucket.
	    const summary_str = `Streak: ${st.streak}   Best: ${st.best_streak}\n` +
				  `Wins: ${st.wins || 0}   Give ups: ${st.giveups || 0}`;
	    const summary = this.add.text(WINDOW_WIDTH / 2, content_y, summary_str,
					  { fontSize: 15, fontFamily: "'Inter', sans-serif",
					    color: COLOR_TEXT, align: "center", lineSpacing: 4 })
		  .setOrigin(0.5, 0).setResolution(RESOLUTION);
	    items.push(summary);

	    const section_header = this.add.text(WINDOW_WIDTH / 2, content_y + 50,
						 "Outcome distribution",
						 { fontSize: 12, fontFamily: "'Inter', sans-serif", color: COLOR_MUTED })
		  .setOrigin(0.5, 0).setResolution(RESOLUTION);
	    items.push(section_header);

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
	    const bar_x = bx + 115;
	    const bar_end_x = bx + bw - 55;
	    const bar_w_full = bar_end_x - bar_x;
	    const count_col_x = bar_end_x + 20;
	    const bar_h = 18;
	    const row_gap = 28;
	    const rows_start_y = content_y + 74;
	    const label_right_x = bar_x - 10;

	    // Row highlight: reflect the bucket of today's daily on the
	    // Daily tab, or the current practice game on the Unlimited
	    // tab. Using today's state (not the live this.VICTORY/count)
	    // keeps the highlight correct while viewing an archived daily.
	    let active_row = -1;
	    if (tab === 'daily' && sub_ended) {
		if (sub_gaveup) active_row = 6;
		else if (sub_victory && sub_ideal !== null) {
		    const over = Math.max(0, sub_count - sub_ideal);
		    active_row = Math.min(over, 5);
		}
	    } else if (tab === 'practice' && mode === 'practice' && ended) {
		if (this.GAVE_UP) active_row = 6;
		else if (this.VICTORY && ideal_steps !== null) {
		    const over = Math.max(0, this.count - ideal_steps);
		    active_row = Math.min(over, 5);
		}
	    }

	    const draw_worm = (g, x, y, w, h, color_int) => {
		if (w <= 0) return;
		g.fillStyle(color_int, 0.95);
		g.fillRoundedRect(x, y, w, h, h / 2);
		const cap = h / 2;
		const rib_spacing = 22;
		const rib_start = x + cap + 4;
		const rib_end = x + w - cap - 4;
		g.lineStyle(1.2, 0x000000, 0.28);
		for (let rx = rib_start; rx <= rib_end; rx += rib_spacing) {
		    g.beginPath();
		    g.moveTo(rx, y + 2);
		    g.lineTo(rx, y + h - 2);
		    g.strokePath();
		}
	    };

	    for (let i = 0; i < rows.length; i++) {
		const r = rows[i];
		const row_y = rows_start_y + i * row_gap;
		const is_active = (i === active_row);
		const label_color = is_active ? (i === 6 ? COLOR_RED : COLOR_GREEN) : COLOR_TEXT;

		if (is_active) {
		    const hl = this.add.graphics();
		    const accent = (i === 6) ? redColor : greenColor;
		    hl.fillStyle(accent, 0.10);
		    hl.fillRoundedRect(bx + 12, row_y - 4, bw - 24, bar_h + 8, 6);
		    items.push(hl);
		}
		const label = this.add.text(label_right_x, row_y + bar_h / 2, r.label,
					    { fontSize: 14, fontFamily: "'Inter', sans-serif",
					      color: label_color, fontStyle: is_active ? "600" : "400" })
		      .setOrigin(1, 0.5).setResolution(RESOLUTION);
		const bar = this.add.graphics();
		bar.fillStyle(mutedColor, 0.20).fillRoundedRect(bar_x, row_y, bar_w_full, bar_h, bar_h / 2);
		if (r.count > 0) {
		    const fw = (r.count / max_count) * bar_w_full;
		    draw_worm(bar, bar_x, row_y, fw, bar_h, r.color);
		}
		const count = this.add.text(count_col_x, row_y + bar_h / 2, String(r.count),
					    { fontSize: 14, fontFamily: "'Inter', sans-serif",
					      color: label_color, fontStyle: is_active ? "600" : "400" })
		      .setOrigin(1, 0.5).setResolution(RESOLUTION);
		items.push(label, bar, count);
	    }
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
	    this.stats_modal_state = null;
	    container.destroy();
	};
	const close_by_key = () => close(true);

	// Track open modal so refresh_stats_modal (called from
	// onAuthStateChanged) can rebuild it after sign-in / sign-out.
	this.stats_modal_state = { mode, won, tab, container };

	// ---- Footer buttons ----
	// Practice tab, current-game-over: View Ideal Solution + New Puzzle.
	if (tab === 'practice' && mode === 'practice' && this.game_over()) {
	    const btn_y = by + bh - 46;
	    const view_btn = this.add_button(bx + bw * 0.28, btn_y, "VIEW IDEAL SOLUTION",
					     14, COLOR_TEXT, 0.5, 0.5, 12, 7);
	    view_btn.zone.on('pointerdown', () => { this.show_solution(); close(false); });
	    const new_btn = this.add_button(bx + bw * 0.72, btn_y, "NEW PUZZLE",
					    14, COLOR_GREEN, 0.5, 0.5, 12, 7);
	    new_btn.zone.on('pointerdown', () => { close(false); this.start_new_practice(); });
	    container.add([view_btn.box, view_btn.text, view_btn.zone,
			   new_btn.box, new_btn.text, new_btn.zone]);
	} else if (tab === 'daily') {
	    // Footer row, centred as a group: SHARE (once today's daily has
	    // ended), SUPPORT SOFTSHADE (Patreon), then the Google sign-in bubble.
	    const daily_done = this.daily_ended_today();
	    const btn_y = by + bh - 46;
	    const row = [];
	    if (daily_done) {
		const share_btn = this.add_button(0, btn_y, "SHARE", 14, COLOR_GREEN, 0.5, 0.5, 14, 7);
		share_btn.zone.on('pointerdown', async () => {
		    const ok = await this.share_result();
		    share_btn.text.setText(ok ? "COPIED!" : "COPY FAILED");
		    this.time.delayedCall(1500, () => {
			if (share_btn.text.active) share_btn.text.setText("SHARE");
		    });
		});
		container.add([share_btn.box, share_btn.text, share_btn.zone]);
		row.push(share_btn);
	    }
	    const support_btn = this.add_button(0, btn_y, "\u2665 SUPPORT SOFTSHADE", 14, COLOR_RED, 0.5, 0.5, 12, 7);
	    support_btn.zone.on('pointerdown', () => { window.open(PATREON_URL, '_blank', 'noopener'); });
	    container.add([support_btn.box, support_btn.text, support_btn.zone]);
	    row.push(support_btn);
	    const auth_x = 0;
	    let label, color;
	    if (!window.WG_AUTH) {
		label = "SIGN-IN UNAVAILABLE"; color = COLOR_MUTED;
	    } else if (this.auth_user) {
		const who = this.auth_user.displayName || this.auth_user.email || 'Google';
		label = `SIGN OUT (${who})`; color = COLOR_RED;
	    } else {
		label = "SIGN IN WITH GOOGLE"; color = COLOR_GREEN;
	    }
	    const auth_btn = this.add_button(auth_x, btn_y, label, 14, color, 0.5, 0.5, 12, 7);
	    if (window.WG_AUTH) {
		auth_btn.zone.on('pointerdown', () => {
		    if (this.auth_user) this.sign_out();
		    else this.sign_in_google();
		});
	    } else {
		auth_btn.zone.input.enabled = false;
	    }
	    container.add([auth_btn.box, auth_btn.text, auth_btn.zone]);
	    row.push(auth_btn);
	    // Lay the row out left to right with even gaps, centred in the modal.
	    const gap = 12;
	    const total = row.reduce((sum, b) => sum + b.zone.width, 0) + gap * (row.length - 1);
	    let x = bx + (bw - total) / 2;
	    for (const b of row) {
		const dx = x - b.zone.x;
		for (const part of [b.box, b.text, b.zone]) part.x += dx;
		x += b.zone.width + gap;
	    }
	    const tip = this.add.text(WINDOW_WIDTH / 2, by + bh - 18,
				      "Press X, Enter, Space, or Esc to close.",
				      { fontSize: 11, fontFamily: "'Inter', sans-serif", color: COLOR_MUTED })
		  .setOrigin(0.5, 0.5).setResolution(RESOLUTION);
	    container.add(tip);
	} else {
	    const tip = this.add.text(WINDOW_WIDTH / 2, by + bh - 22,
				      "Press X, Enter, Space, or Esc to close.",
				      { fontSize: 12, fontFamily: "'Inter', sans-serif", color: COLOR_MUTED })
		  .setOrigin(0.5, 0.5).setResolution(RESOLUTION);
	    container.add(tip);
	}

	this.modal_open = true;
	kb.on('keydown-ENTER', close_by_key);
	kb.on('keydown-SPACE', close_by_key);
	kb.on('keydown-ESC', close_by_key);
	// Backdrop absorbs clicks (keeping setInteractive() swallows them
	// so nothing underneath fires) but no longer closes the modal —
	// the X button in the top-right handles that explicitly.
    }

    // A dismissible overlay explaining the rules.
    //
    // Unlike the other modals this one is plain DOM (#wg-rules in
    // index.html) rather than Phaser objects. Canvas text is invisible
    // to screen readers and to search-engine crawlers, and the rules
    // are the only real prose the game has — keeping them in the
    // markup is what makes the page indexable for "word ladder" and
    // friends. The panel is styled in index.html to match the canvas
    // modals; only the show/hide wiring lives here.
    create_rules_modal() {
	const el = document.getElementById('wg-rules');
	if (!el) return { show() {}, hide() {} };

	const modal = {
	    show() { el.hidden = false; },
	    hide() { el.hidden = true;  },
	};
	// onclick rather than addEventListener: the scene can be created
	// more than once (restart), and assigning replaces the previous
	// handler instead of stacking a new one on the same button.
	el.querySelector('.wg-rules-close').onclick = () => modal.hide();
	modal.hide();
	return modal;
    }

    // Load game mode buttons (with bubble boxes). Daily Puzzle is
    // rendered at full size; the side buttons are ~10% smaller so
    // Daily visually stands out as the primary option.
    load_gamemodes() {
	const PAD_X = 18, PAD_Y = 10;
	// Side buttons shrunk to ~82% so the DAILY button has room to
	// grow with the puzzle number (e.g. "DAILY PUZZLE #100") without
	// colliding with UNLIMITED or FREE PLAY.
	const SIDE_FONT = Math.round(WORD_FONTSIZE * 0.82);
	const SIDE_PAD_X = Math.round(PAD_X * 0.82), SIDE_PAD_Y = Math.round(PAD_Y * 0.82);

	// Practice — persists the current puzzle across sessions; tapping
	// the button simply brings you back to whatever practice game is
	// currently in progress (or rolls a new one if there isn't one).
	this.regular = this.add_button(GMODE1_X, GMODE1_Y, "UNLIMITED", SIDE_FONT, COLOR_RED, 0, 0.5, SIDE_PAD_X, SIDE_PAD_Y);
	this.regular.zone.on('pointerdown', () => {
	    this.exit_archive();
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

	// Daily puzzle — curated start/goal pair, with the puzzle number
	// baked into the button label. update_daily_button() recreates it
	// so enter_archive / exit_archive can swap in the archived date's
	// puzzle number.
	this.update_daily_button();

	// Free play — user enters start and goal words
	this.free_play = this.add_button(GMODE3_X, GMODE3_Y, "FREE PLAY", SIDE_FONT, COLOR_RED, 1, 0.5, SIDE_PAD_X, SIDE_PAD_Y);
	this.free_play.zone.on('pointerdown', () => {
	    this.exit_archive();
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
