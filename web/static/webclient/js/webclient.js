const revision = 102;
const term = new Terminal({
    convertEol: true,
    allowProposedApi: true,
    disableStdin: false,
    fontFamily: '"Fira Code", Menlo, monospace',
    fontSize: 19,
    cursorBlink: true,
    customGlyphs: true,
    cursorStyle: 'block',
    rescaleOverlappingGlyphs: false,
    scrollback: 8192,
});
term.write('\x1b[1;97mxtermia\x1b[0m terminal emulator (made with xterm.js) revision \x1b[1;97m' + revision + '\x1b[0m\r\n');

let ws_ready = false;
let ws = new WebSocket(wsurl + '?' + csessid);
// const unicode11Addon = new Unicode11Addon.Unicode11Addon();
// term.loadAddon(unicode11Addon);
// term.unicode.activeVersion = '11';
const fitAddon = new FitAddon.FitAddon();
term.loadAddon(fitAddon);

const webglAddon = new WebglAddon.WebglAddon();
webglAddon.onContextLoss(e => {
    webglAddon.dispose();
});
term.loadAddon(webglAddon);
const weblinksAddon = new WebLinksAddon.WebLinksAddon();
term.loadAddon(weblinksAddon);
const el_terminal = document.getElementById('terminal');
let audio = new Audio();

let map_enabled = false;
let map_column = 0;
let map_max_width = 0;

function calcMapSize(term_columns) {
    map_column = Math.ceil(term_columns / 2) + 1;
    map_max_width = term_columns - map_column;
}

function setMapSize(term_columns) {
    calcMapSize(term_columns);
    ws.send(JSON.stringify(['term_size', [term.cols - map_max_width - 1, term.rows], {}]));
}

term.onResize(e => {
    fitAddon.fit();
    if (ws_ready) {
        if (map_enabled) {
            // reserve half the terminal width for map
            setMapSize(e.cols);
            ws.send(JSON.stringify(['map_size', [map_max_width, term.rows - 1], {}]));
        } else {
            ws.send(JSON.stringify(['term_size', [e.cols, e.rows], {}]));
        }
    }
});

const max_len = 128;
let history = [];
let player_commands = [];
let command = '';
let completion = '';
let prompt = '';
let prompt_len = 0;
let index = -1;
let last_dir = 0; // 0 = none, 1 = down, 2 = up
let interactive_mode = false;
let cursor_x = 0;  // these are used during interactive mode to keep track of relative cursor position
let cursor_y = 0;
let self_paste = false; // did we send the paste? or is the right-click menu being used?
let self_write = false; // if true, don't do onData events
let enter_pressed = false;
let censor_input = true; // until login, don't echo input commands so that password isn't leaked
let map = '';
let map_width = 0;
let map_height = 0;
const ansi_color_regex = /\x1B\[[0-9;]+m/g
const grey = '\x1B[38;5;243m';
const reset = '\x1B[0m';
const command_color = '\x1B[38;5;220m';
const highlight = '\x1B[48;5;24m';
let cursor_pos = 0;

function doPaste() {
    navigator.clipboard.readText()
        .then(text => {
            const end = command.substring(cursor_pos);
            const start = command.substring(0, cursor_pos);
            command = start + text + end;
            term.write(clearBuffer() + prompt + start + text + '\x1B7' + end + '\x1B8');
            cursor_pos += text.length;
            enter_pressed = false;
        })
        .catch(err => {
            console.log('Clipboard error: ', err);
        });
}

function getCompletion(c) {
    for (let i = 0; i < history.length; i++) {
        if (history[i].length > c.length && history[i].startsWith(c)) {
            return [true, history[i]];
        }
    }
    for (let i = 0; i < player_commands.length; i++) {
        if (player_commands[i].length > c.length && player_commands[i].startsWith(c)) {
            return [true, player_commands[i]];
        }
    }
    return [false];
}

function clearBuffer() {
    // clear buffer from cursor to the end
    let update = '\r\x1B[0J';
    if (map_enabled) {
        update += clearMap() + writeMap();
    }
    return update;
}

function onDefault(e) {
    command = command.substring(0, cursor_pos) + e + command.substring(cursor_pos);
    cursor_pos += 1;
    index = history.length - 1;
    last_dir = 0;
    let update = '';
    // insert characters if cursor has been moved
    if (cursor_pos !== command.length) {
        update += clearBuffer() + prompt + '\x1B7' + command + '\x1B8\r\x9B' + (cursor_pos + prompt_len) + 'C'
        term.write(update);
        return;
    }
    const result = getCompletion(command);
    update += clearBuffer() + prompt + command;
    if (result[0]) {
        const sub = result[1].substring(command.length);
        completion = sub;
        update += '\x1B7' + grey + sub + reset + '\x1B8';
    } else {
        completion = '';
    }
    term.write(update);
}

function onEnter() {
    if (command !== '') {
        let update = '';
        const lines = command.split('\n');
        if (censor_input) {
            ws.send(JSON.stringify(['text', [command], {}]));
            if (lines.length > 1 && cursor_pos > lines[0].length) {
                update += '\x9B' + (lines.length - 1) + 'F';
            }
            update += clearBuffer() + '\r\n';
            cursor_pos = 0;
            command = '';
            term.write(update);
            return;
        }
        if (history.length > max_len) {
            history.shift();
        }
        const found_index = history.indexOf(command);
        if (found_index === -1) {
            index = history.push(command) - 1;
        } else {
            history.splice(found_index, 1);
            index = history.push(command) - 1;
        }
        if (lines.length > 1 && cursor_pos > lines[0].length) {
            update += '\x9B' + (lines.length - 1) + 'F';
        }
        update += clearBuffer() + command_color + command + reset + '\r\n';
        term.write(update);
        last_dir = 1;
        enter_pressed = true;
        cursor_pos = 0;
        ws.send(JSON.stringify(['text', [command], {}]));
    }
}

function onDelete() {
    if (cursor_pos < command.length) {
        const sub = command.substring(cursor_pos + 1);
        command = command.substring(0, cursor_pos) + sub;
        term.write(clearBuffer() + prompt + '\x1B7' + command + '\x1B8\r\x9B' + (cursor_pos + prompt_len) + 'C');
    }
}

function onBackspace() {
    if (command.length !== 0 && cursor_pos > 0) {
        const lines = command.split('\n');
        if (lines.length > 1) {
            if (cursor_pos > lines[0].length) {
                // move cursor up if necessary
                term.write('\x9B' + (lines.length - 1) + 'F' + clearBuffer() + prompt);
            } else {
                term.write(clearBuffer() + prompt);
            }
            command = '';
            cursor_pos = 0;
            return;
        }
        // backspace can be in the middle of a line
        const sub = command.substring(cursor_pos);
        command = command.substring(0, cursor_pos - 1) + sub;
        cursor_pos -= 1;
        let update = clearBuffer() + prompt + '\x1B7' + command + '\x1B8\r\x9B' + (cursor_pos + prompt_len) + 'C';
        const result = getCompletion(command);
        if (result[0]) {
            const c = result[1].substring(command.length);
            completion = c;
            update += '\x1B7' + grey + c + reset + '\x1B8';
        } else {
            completion = '';
        }
        term.write(update);
    }
}

function onArrowRight() {
    if (completion.length > 0 && cursor_pos === command.length) {
        command = command.concat(completion);
        term.write(clearBuffer() + prompt + command);
        cursor_pos += completion.length;
        completion = '';
        return;
    }
    const lines = command.split('\n');
    if ((lines.length > 1 && cursor_pos < lines[0].trim().length) || (lines.length === 1 && cursor_pos < command.length)) {
        cursor_pos += 1;
        completion = '';
        // rewrite the whole thing to remove highlight if necessary
        term.write(clearBuffer() + prompt + '\x1B7' + command + '\x1B8\r\x9B' + (cursor_pos + prompt_len) + 'C');
    }
}

function onArrowUp() {
    if (index === -1) {
        return;
    } else if (last_dir !== 0 && index > 0) {
        index -= 1;
    }
    const lines = command.split('\n');
    command = history[index];
    if (lines.length > 1 && cursor_pos > lines[0].length) {
        term.write('\x9B' + (lines.length - 1) + 'F' + clearBuffer() + prompt + command);
    } else {
        term.write(clearBuffer() + prompt + command);
    }
    cursor_pos = command.length;
    last_dir = 2;
}

function onArrowDown() {
    const lines = command.split('\n');
    if (index < history.length - 1) {
        index += 1;
        command = history[index];
        if (lines.length > 1 && cursor_pos > lines[0].length) {
            term.write('\x9B' + (lines.length - 1) + 'F' + clearBuffer() + prompt + command);
        } else {
            term.write(clearBuffer() + prompt + command);
        }
        cursor_pos = command.length;
        last_dir = 1;
    } else if (cursor_pos !== 0) { // we're at the bottom of history, clear it
        if (lines.length > 1 && cursor_pos > lines[0].length) {
            term.write('\x9B' + (lines.length - 1) + 'F' + clearBuffer() + prompt);
        } else {
            term.write(clearBuffer() + prompt);
        }
        command = '';
        completion = '';
        cursor_pos = 0;
        last_dir = 0;
    }
}

function onArrowLeft() {
    if (cursor_pos > 0) {
        const lines = command.split('\n');
        if (lines.length > 1) {
            if (cursor_pos > lines[0].length) {
                // move cursor up first if necessary
                term.write('\x9B' + (lines.length - 1) + 'F' + clearBuffer() + prompt);
            } else {
                term.write(clearBuffer() + prompt);
            }
            cursor_pos = 0;
            command = '';
        } else {
            cursor_pos -= 1;
            term.write('\x9B1D');
        }
    }
}

function onHome() {
    if (cursor_pos > 0) {
        cursor_pos = 0;
        term.write(clearBuffer() + prompt + '\x1B7' + command + '\x1B8\r\x9B' + prompt_len + 'C');
    }
}

function onEnd() {
    if (cursor_pos < command.length) {
        const lines = command.split('\n');
        if (lines.length > 0) {
            // for multi-line commands, go to end of first line.  proper multi-line editing might be added later...
            term.write(clearBuffer() + prompt + '\x1B7' + command + '\x1B8\r\x9B' + (prompt_len + lines[0].length) + 'C');
            cursor_pos = lines[0].length;
        } else {
            term.write(clearBuffer() + prompt + command);
            cursor_pos = command.length;
        }
    }
}

let control_down = false;
let c_down = false;
let v_down = false;
let action_done = false;

function onKey(e) {
    if (self_write) {
        self_write = false;
        return false;
    }
    if (interactive_mode) {
        return true;  // go straight to onData
    }
    switch (e.type) {
        case 'keypress':
            return true; // pass the event along
        case 'keydown':
            switch (e.key) {
                case 'Control':
                    control_down = true;
                    break;
                case 'c':
                    c_down = true;
                    break;
                case 'v':
                    v_down = true;
                    break;
                case 'ArrowLeft':
                    enter_pressed = false;
                    onArrowLeft();
                    return false;
                case 'ArrowRight':
                    enter_pressed = false;
                    onArrowRight();
                    return false;
                case 'ArrowUp':
                    enter_pressed = false;
                    onArrowUp();
                    return false;
                case 'ArrowDown':
                    enter_pressed = false;
                    onArrowDown();
                    return false;
                case 'Home':
                    enter_pressed = false;
                    onHome();
                    return false;
                case 'End':
                    enter_pressed = false;
                    onEnd();
                    return false;
                case 'Delete':
                    enter_pressed = false;
                    onDelete();
                    return false;
                default:
                    break;
            }
            break;
        case 'keyup':
            switch (e.key) {
                case 'Control':
                    control_down = false;
                    break;
                case 'c':
                    c_down = false;
                    break;
                case 'v':
                    v_down = false;
                    break;
                default:
                    return false;
            }
            action_done = false;
            break;
        default:
            return false;
    }
    if (enter_pressed && e.key !== 'Enter') {  // clear the command
        enter_pressed = false;
        term.write(clearBuffer() + prompt);
        command = '';
        cursor_pos = 0;
    }
    if (control_down && c_down && !action_done) {
        navigator.clipboard.writeText(term.getSelection());
        action_done = true;
        return false;
    } else if (control_down && v_down && !action_done) {
        action_done = true;
        self_paste = true;
        doPaste();
        return false;
    }
    return true;
}

function onData(d) {
    if (self_write) {
        self_write = false;
        return;  // don't process our own messages
    }
    if (interactive_mode) {
        ws.send(JSON.stringify(['interact', [d], {}]));
        return;
    }
    const ord = d.charCodeAt(0);
    if (d.length !== 1 && ord !== 0x1b) {  // hacky paste detection for right-click paste, avoid control codes
        // paste!
        if (!self_paste) {
            d = d.replace(/\r\n?/g, '\r\n');
            const end = command.substring(cursor_pos);
            const start = command.substring(0, cursor_pos);
            command = start + d + end;
            term.write(clearBuffer() + prompt + start + d + '\x1B7' + end + '\x1B8');
            cursor_pos += d.length;
            enter_pressed = false;
        }
        self_paste = false;
        return;
    }
    if (ord === 0x1b) {
        switch (d.substring(1)) {
            case '[A': // Up arrow
                onArrowUp();
                break;
            case '[B': // Down arrow
                onArrowDown();
                break;
            case '[D': // Left Arrow
                onArrowLeft();
                break;
            case '[C': // Right Arrow
                onArrowRight();
                break;
            case '[3~': // Delete
                onDelete();
                break;
        }
    } else if (ord < 32 || ord === 0x7f) {
        switch (d) {
            case '\r': // ENTER
                onEnter();
                break;
            case '\x7F': // BACKSPACE
                onBackspace();
                break;
            case '\t': // TAB
                onArrowRight();
                break;
        }

    } else {
        onDefault(d);
    }
}

function relPos(x, y) {
    x = x - cursor_x;
    y = y - cursor_y;
    let update = '';
    if (y > 0) {
        update += '\x9B' + y + 'A'; // cursor up N
    } else if (y < 0) {
        update += '\x9B' + (y * -1) + 'B'; // cursor down N
    }
    if (x > 0) {
        update += '\x9B' + x + 'C'; // cursor forward N
    } else if (x < 0) {
        update += '\x9B' + (x * -1) + 'D'; // cursor back N
    }
    cursor_x = x;
    cursor_y = y;
    return update;
}

function writeSelf(d) {
    if (interactive_mode) {
        self_write = true;
    }
    term.write(d);
}

function cursorHome() {
    // move cursor to where it was when interactive_mode started
    let update = '';
    if (cursor_x > 0) {
        update += '\x9B' + cursor_x + 'D';
    } else if (cursor_x < 0) {
        update += '\x9B' + (cursor_x * -1) + 'C';
    }
    if (cursor_y > 0) {
        update += '\x9B' + cursor_y + 'B';
    } else if (cursor_x < 0) {
        update += '\x9B' + (cursor_y * -1) + 'A';
    }
    cursor_x = 0;
    cursor_y = 0;
    return update;
}

function clearMap() {
    let update = '';
    update += '\x1B7';  // save cursor
    for (let i = 0; i < term.rows; i++) {
        // move cursor, clear to end
        update += '\x9B';
        update += (i + 1);
        update += ';';
        update += (map_column + 1);
        update += 'H\x1B[0K';
    }
    update += '\x1B8';  // restore cursor
    return update;
}

function writeMap() {
    let update = '';
    let y = 2; // for centering vertically
    update += '\x1B7';  // save cursor
    let pre_pad = '';  // for centering horizontally
    let pad_height = Math.floor((term.rows - 2 - map_height) / 2);
    if (pad_height > 0) {
        y += pad_height;
    }
    const pre_pad_len = Math.floor((term.cols - map_column - map_width) / 2);
    if (pre_pad_len > 0) {
        pre_pad = ' '.repeat(pre_pad_len);
    }
    for (let i = 0; i < map.length; i++) {
        update += '\x9B';
        update += (i + y);
        update += ';';
        update += (map_column + 1);
        update += 'H';
        update += pre_pad;
        update += map[i];
    }
    update += '\x1B8';  // restore cursor
    return update;
}

function wrap(input) {
    // wrap input to width, ignoring control codes
    const width = map_enabled ? term.cols - map_max_width - 1 : term.cols;
    let output = '';
    let len = 0;
    let is_ansi = false;
    for (let i = 0; i < input.length; i++) {
        if (is_ansi) {
            if (input[i] === 'm' || input[i] === 'K') {
                output += input[i];
                is_ansi = false;
            } else {
                output += input[i];
            }
        } else {
            if (input[i] === '\x1b') {
                output += '\x1b';
                is_ansi = true;
            } else {
                if (input[i] === '\r' || input[i] === '\n') {
                    output += input[i];
                    len = 0;
                } else {
                    if (len === width) {
                        output += '\n';
                        len = 0;
                    }
                    output += input[i];
                    len += 1;
                }
            }
        }
    }
    return output;
}

term.onData(e => onData(e));
term.attachCustomKeyEventHandler(e => onKey(e));
term.open(el_terminal);
fitAddon.fit();
ws.onopen = function () {
    term.write('\r\n======== Connected.\r\n');
    ws_ready = true;
    ws.send(JSON.stringify(['term_size', [term.cols, term.rows], {}]));
};
ws.onclose = function () {
    term.write('\r\n======== Connection lost.\r\n');
    ws_ready = false;
};

function onText(input) {
    let update = '';
    update += clearBuffer();
    if (map_enabled) {
        update += wrap(input) + reset;
        update += clearMap() + writeMap();
    } else {
        update += input + reset;
    }
    update += prompt;
    if (command.length > 0 && completion.length === 0) {
        update += '\x1B7' + highlight + command + reset + '\x1B8';
        term.write(update);
        return;
    } else if (completion.length > 0) {
        update += highlight + command + reset;
        update += grey + completion + reset + '\x9B' + completion.length + 'D';
    }
    term.write(update);
}

function onClearLine(line) {
    let update = cursorHome();
    if (line > 0) {
        update += '\x9B' + line + 'A';
    } else if (line < 0) {
        update += '\x9B' + (line * -1) + 'B';
    }
    cursor_y += line;
    if (map_enabled) {
        const width = (term.cols - map_max_width) - cursor_x;
        update += '\r' + ' '.repeat(width);
    } else {
        update += '\x9B2K'; // clear line
    }
    update += cursorHome();
    writeSelf(update);
}

ws.onmessage = function (e) {
    let msg = JSON.parse(e.data);
    switch (msg[0]) {
        case 'text':
            onText(msg[1][0]);
            break;
        case 'raw_text':  // default text messages get /r/n appended to them before being sent, this doesn't
            if (map_enabled) {
                writeSelf(clearMap() + wrap(msg[1][0]) + writeMap());
            } else {
                writeSelf(msg[1][0]);
            }
            break;
        case 'insert_text':  // print raw_text and move the cursor back
            writeSelf(msg[1][0] + '\x9B' + msg[1][0].length + 'D');
            break;
        case 'cursor_up':
            cursor_y += 1;
            writeSelf('\x1B[A');
            break;
        case 'cursor_down':
            cursor_y -= 1;
            writeSelf('\x1B[B');
            break;
        case 'cursor_right':
            cursor_x += 1;
            writeSelf('\x1B[C');
            break;
        case 'cursor_left':
            cursor_x -= 1;
            writeSelf('\x1B[D');
            break;
        case 'cursor_home':  // move the cursor back to where interactive mode started
            writeSelf(cursorHome());
            break;
        case 'clear_line':
            /* command signature: clear_line=row
              moves cursor to line relative from where interactive_start was sent and clears it.
              cursor is then moved back to where it was.
              positive values go up, negative go down, and 0 clears the current line */
            onClearLine(msg[1][0]);
            break;
        case 'pos_cursor':
            // move cursor to relative position from where interactive_start was issued, same rules as below
            // command signature: pos_cursor=[row, column]
            writeSelf(relPos(msg[1][0], msg[1][1]));
            break;
        case 'pos_text':
            /* print text at relative position from where interactive_start was sent
               command signature: pos_text=[column, row, msg]
               relative position (column,row) from the beginning of the line where interactive_start was sent
               positive numbers go up (row), or right (column)
               negative numbers go down (row), or left (column)
               i.e. position[0,1,'msg', 4] goes straight up one line, prints 'msg ' at start of row, and returns the cursor */
            const old_x = cursor_x;
            const old_y = cursor_y;
            let update = cursorHome();
            update += relPos(msg[1][0], msg[1][1]);
            update += msg[1][2] + '\x9B' + msg[1][2].length + 'D'; // text + cursor back
            update += relPos(old_x, old_y);
            cursor_x = old_x;
            cursor_y = old_y;
            writeSelf(update);
            break;
        case 'prompt':
            prompt = msg[1][0];
            prompt_len = msg[1][0].replace(ansi_color_regex, '').length;
            break;
        case 'audio':
            audio.pause();
            audio.src = msg[1][0];
            audio.play();
            break;
        case 'audio_pause':
            audio.pause();
            break;
        case 'logged_in':
            censor_input = false;
            break;
        case 'interactive_start':
            interactive_mode = true;
            cursor_x = 0;
            cursor_y = 0;
            term.write('\x1B7'); // save cursor
            break;
        case 'interactive_end':
            interactive_mode = false;
            term.write('\x1B8'); // restore cursor
            break;
        case 'player_commands':
            player_commands = msg[1];
            break;
        case 'map_enable':
            map_enabled = true;
            // reserve half the terminal width for map
            setMapSize(term.cols)
            break;
        case 'map_disable':
            map_enabled = false;
            ws.send(JSON.stringify(['term_size', [term.cols, term.rows], {}]));
            break;
        case 'get_map_size':
            // return the maximum map dimensions for current terminal size
            // this cannot be used to check if map is enabled
            // because this specifically supports getting what the map size *will*
            // be, in case map size is requested before map is enabled
            calcMapSize(term.cols);
            ws.send(JSON.stringify(['map_size', [map_max_width, term.rows - 1], {}]));
            break;
        case 'map':
            if (map_enabled) {
                map = msg[1].split(/\r?\n/);
                // strip ANSI before checking width
                const stripped = msg[1].replace(ansi_color_regex, '').split(/\r?\n/);
                // figure out map width so it can be centered
                map_width = 0;
                map_height = map.length;
                for (let i = 0; i < stripped.length; i++) {
                    if (stripped[i].length > map_width) {
                        map_width = stripped[i].length;
                    }
                }
                term.write(clearMap() + writeMap());
            }
            break;
        default:
            console.log('Unknown command: ' + msg);
    }
}
ws.onerror = function (e) {
    console.log(e);
    term.write('\r\n======== Connection error: ' + e + '\r\n');
};
term.focus();
window.addEventListener('focus', (e) => {
    term.focus();
});
window.addEventListener('keydown', (e) => {
    term.focus();
});
window.addEventListener('resize', function (e) {
    // clear map before resize
    if (map_enabled) {
        term.write(clearMap(), () => {
            fitAddon.fit();
            term.write(writeMap());
        });
    } else {
        fitAddon.fit();
    }
}, true);