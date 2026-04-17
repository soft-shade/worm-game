const WINDOW_WIDTH = 640;
const WINDOW_HEIGHT = 640;

const HISTORY_BOX_W = WINDOW_WIDTH*6/10
const HISTORY_BOX_X = WINDOW_WIDTH*5/10 - HISTORY_BOX_W/2
const HISTORY_BOX_H = WINDOW_HEIGHT*6/10
const HISTORY_BOX_Y = WINDOW_HEIGHT*4/10 - HISTORY_BOX_H/2 + 18
const HISTORY_BOX_FONTSIZE = 24

const INPUT_BOX_X = WINDOW_WIDTH *5/10;
const INPUT_BOX_Y = WINDOW_HEIGHT*9.5/10;

const ERROR_BOX_X = WINDOW_WIDTH *5/10;
const ERROR_BOX_Y = WINDOW_HEIGHT*8.55/10;

const WORD_FONTSIZE = HISTORY_BOX_FONTSIZE
const ACTION_FONTSIZE = 18
const PREV_WORD_X = WINDOW_WIDTH *2/10;
const PREV_WORD_Y = WINDOW_HEIGHT*8/10;
const SCORE_X = WINDOW_WIDTH*5/10;
const SCORE_Y = PREV_WORD_Y;
const GOAL_WORD_X = WINDOW_WIDTH *8/10;
const GOAL_WORD_Y = PREV_WORD_Y;

// Bottom row buttons sit above the input field, with enough vertical
// separation that their outlined/shadowed boxes don't overlap.
const RESET_X = WINDOW_WIDTH * 0.5/10
const RESET_Y = WINDOW_HEIGHT * 8.88/10

const RESTART_X = WINDOW_WIDTH * 0.5/10
const RESTART_Y = WINDOW_HEIGHT * 9.5/10

const SOLUTION_X = WINDOW_WIDTH * 9.5/10
const SOLUTION_Y = WINDOW_HEIGHT * 8.88/10

const SOUND_TOGGLE_X = WINDOW_WIDTH * 9.5/10
const SOUND_TOGGLE_Y = WINDOW_HEIGHT * 9.5/10

const RESOLUTION = 5

// Game-mode buttons. Insets from the left/right edges leave room for
// the bubble outline + drop shadow without clipping.
const GMODE1_X = WINDOW_WIDTH * 0.8/10
const GMODE2_X = WINDOW_WIDTH * 5/10
const GMODE3_X = WINDOW_WIDTH * 9.2/10
const GMODE1_Y = WINDOW_HEIGHT * 0.4/10
const GMODE2_Y = WINDOW_HEIGHT * 0.4/10
const GMODE3_Y = WINDOW_HEIGHT * 0.4/10

const COLOR_TEXT = "#cdd6f4"
const COLOR_RED = "#f38ba8"
const COLOR_GREEN = "#a6e3a1"
const COLOR_BLUE = "#89b4fa"
const COLOR_BG = "#1e1e2e"
const COLOR_BOX_FILL = "#313244"
const COLOR_MUTED = "#6c7086"

const FREEPLAY_STAGES = {
    none: 0,
    first_word: 1,
    second_word: 2
}
