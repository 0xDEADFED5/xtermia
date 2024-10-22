const revision = 115;
// try to get options from localstorage, otherwise set the defaults
let fsize = localStorage.getItem('fontsize');
if (fsize === null) {
    fsize = 19;
} else {
    fsize = parseInt(fsize);
}
const cstyle = localStorage.getItem('cursorstyle') || 'block';
let cblink = localStorage.getItem('cursorblink');
if (cblink === null) {
    cblink = true;
} else {
    cblink = cblink === 'true';
}
let min_contrast = localStorage.getItem('contrast');
if (min_contrast === null) {
    min_contrast = 1;
} else {
    min_contrast = parseFloat(min_contrast);
}
let screen_reader = localStorage.getItem('reader');
if (screen_reader === null) {
    screen_reader = false;
} else {
    screen_reader = screen_reader === 'true';
}
let sback = localStorage.getItem('scrollback');
if (sback === null) {
    sback = 8192;
} else {
    sback = parseInt(sback);
}
let custom_glyphs = localStorage.getItem('glyphs');
if (custom_glyphs === null) {
    custom_glyphs = true;
} else {
    custom_glyphs = custom_glyphs === 'true';
}
let autosave_setting = localStorage.getItem('autosave');
if (autosave_setting === null) {
    autosave_setting = false;
} else {
    autosave_setting = autosave_setting === 'true';
}
const font_family = localStorage.getItem('font') || '"Fira Code", Menlo, monospace';
const term = new Terminal({
    convertEol: true,
    allowProposedApi: true,
    disableStdin: false,
    fontFamily: font_family,
    fontSize: fsize,
    cursorBlink: cblink,
    customGlyphs: custom_glyphs,
    cursorStyle: cstyle,
    rescaleOverlappingGlyphs: false,
    scrollback: sback,
    minimumContrastRatio: min_contrast,
    screenReaderMode: screen_reader,
});
let recording_start = 0;
let recording_buffer = '';
let recording = false;
let recording_header = {
    "version": 2,
    "width": 80,
    "height": 24,
    "timestamp": 0,
    "duration": 0,
    "title": "xtermia recording"
};
wrapWrite('\x1b[1;97mxtermia\x1b[0m terminal emulator (made with xterm.js) revision \x1b[1;97m' + revision + '\x1b[0m\n');
wrapWrite('Enter :help for a list of \x1b[1;97mxtermia\x1b[0m commands')
let player_commands = [];
const commands = new Map();
commands.set(':help', [help, ':help = This lists all available commands']);
commands.set(':fontsize', [fontsize, ':fontsize [size] = Change font size to [size]. Default = 19']);
commands.set(':fontfamily', [fontfamily, ':fontfamily [font] = Change font family. Default = "Fira Code"']);
commands.set(':contrast', [contrast, ':contrast [ratio] = Change minimum contrast ratio, 21 = black and white. Default = 1']);
commands.set(':reader', [reader, ':reader = Toggle screenreader mode for NVDA or VoiceOver. Default = off']);
commands.set(':cursorstyle', [cursorstyle, ':cursorstyle [block,underline,bar] = Change cursor style. Default = block']);
commands.set(':cursorblink', [cursorblink, ':cursorblink = Toggle cursor blink. Default = on']);
commands.set(':glyphs', [glyphs, ':glyphs = Toggle custom glyphs (fixes some box-drawing glyphs). Default = on']);
commands.set(':scrollback', [scrollback, ':scrollback [rows] = Rows of terminal history. Default = 8192']);
commands.set(':record', [record, ':record = Begin asciinema recording (share at http://terminoid.com/).']);
commands.set(':stop', [stop, ':stop = Stop asciinema recording and save JSON file.']);
commands.set(':save', [save, ':save = Save terminal history to history.txt']);
commands.set(':autosave', [autosave, ':autosave = Toggle autosave. If enabled, history will be saved on connection close. Default = off']);
commands.set(':reset', [reset_command, ':reset = Clear local storage and reset settings to default']);
for (const [key, value] of commands) {
    player_commands.push(key);
}

function help(arg) {
    let update = 'Available commands:\n';
    for (const [key, value] of commands) {
        if (map_enabled) {
            update += wrap(value[1]) + '\n';
        } else {
            update += value[1] + '\n';
        }
    }
    if (map_enabled) {
        update += clearMap() + writeMap();
    }
    wrapWrite(update);
}

function reset_command(arg) {
    localStorage.clear();
    term.options.fontSize = 19;
    term.options.cursorStyle = 'block';
    term.options.cursorBlink = true;
    term.options.screenReaderMode = false;
    term.options.minimumContrastRatio = 1;
    term.options.scrollback = 8192;
    term.options.customGlyphs = true;
    autosave_setting = false;
    term.options.fontFamily = '"Fira Code", Menlo, monospace';
    fitAddon.fit();
}

function fontfamily(arg) {
    try {
        term.options.fontFamily = arg;
        fitAddon.fit();
        localStorage.setItem("font", arg);
        wrapWriteln('Font changed to: ' + arg + '.');
        wrapWriteln('If this looks terrible, enter :reset to go back to default font.');
    } catch (e) {
        console.error(e);
        wrapWriteln(e);
        term.options.fontFamily = '"Fira Code", Menlo, monospace';
    }
}

function glyphs(arg) {
    custom_glyphs = !custom_glyphs;
    term.options.customGlyphs = custom_glyphs;
    if (custom_glyphs) {
        wrapWriteln('Custom glyphs are ON.');
        localStorage.setItem("glyphs", "true");
    } else {
        wrapWriteln('Custom glyphs are OFF.');
        localStorage.setItem("glyphs", "false");
    }
}

function scrollback(arg) {
    term.options.scrollback = parseInt(arg);
    localStorage.setItem("scrollback", arg);
}

function reader(arg) {
    // TODO: let Evennia know screenreader status
    screen_reader = !screen_reader;
    term.options.screenReaderMode = screen_reader;
    if (screen_reader) {
        wrapWriteln('Screen reader is ON.');
        localStorage.setItem("reader", "true");
    } else {
        wrapWriteln('Screen reader is OFF.');
        localStorage.setItem("reader", "false");
    }
}

function contrast(arg) {
    term.options.minimumContrastRatio = parseFloat(arg);
    localStorage.setItem("contrast", arg);
    wrapWriteln('Minimum contrast ratio is: ' + arg + '.');
}

function cursorblink(arg) {
    cblink = !cblink;
    term.options.cursorBlink = cblink;
    if (cblink) {
        wrapWriteln('Cursor blink is ON.');
        localStorage.setItem("cursorblink", "true");
    } else {
        wrapWriteln('Cursor blink is OFF.');
        localStorage.setItem("cursorblink", "false");
    }
}

function cursorstyle(arg) {
    if (arg === 'block' || arg === 'underline' || arg === 'bar') {
        term.options.cursorStyle = arg;
        localStorage.setItem("cursorstyle", arg);
        wrapWriteln('Cursor style is: ' + arg + '.');
    } else {
        wrapWriteln("Invalid cursor style! Must be block, underline, or bar.");
    }
}

function fontsize(arg) {
    term.options.fontSize = parseInt(arg);
    fitAddon.fit();
    localStorage.setItem("fontsize", arg);
    wrapWriteln('Font size is: ' + arg + '.');
}

function save(arg) {
    history = '';
    for (let i = 0; i < term.buffer.active.length; i++) {
        history += term.buffer.active.getLine(i).translateToString() + '\n';
    }
    saveBlob('history.txt', history);
    localStorage.setItem('history', history);
    wrapWriteln('Terminal history saved.');
}

function autosave(arg) {
    autosave_setting = !autosave_setting;
    if (autosave_setting) {
        localStorage.setItem('autosave', 'true');
        wrapWriteln('Autosave is ON.');
    } else {
        localStorage.setItem('autosave', 'false');
        wrapWriteln('Autosave is OFF.');
    }
}

function record(arg) {
    recording_start = Date.now();
    recording_header.width = term.cols;
    recording_header.height = term.rows;
    recording_header.timestamp = Math.round(recording_start / 1000);
    recording = true;
}

function addRecord(str) {
    const time = (Date.now() - recording_start) / 1000;
    recording_buffer += JSON.stringify([time, "o", str]) + '\n';
}

function wrapWrite(d, f) {
    // wrap all term.write() calls with this to enable recording
    term.write(d, f);
    if (recording) {
        addRecord(d);
    }
}

function wrapWriteln(d, f) {
    // wrap all term.writeln() calls with this to enable recording
    term.writeln(d, f);
    if (recording) {
        addRecord(d);
    }
}

function stop(arg) {
    if (recording) {
        recording = false;
        recording_header.duration = (Date.now() - recording_start) / 1000;
        saveBlob('recording.cast', JSON.stringify(recording_header) + '\n' + recording_buffer);
    } else {
        wrapWriteln("Recording hasn't begun!");
    }
}

function handle_command(command) {
    for (const [key, value] of commands) {
        if (command.startsWith(key)) {
            if (command.includes(' ')) {
                value[0](command.substring(command.indexOf(' ') + 1));
            } else {
                value[0]();
            }
        }
    }
}

function saveBlob(filename, data) {
    const blob = new Blob([data], {type: 'text/csv'});
    if (window.navigator.msSaveOrOpenBlob) {
        window.navigator.msSaveBlob(blob, filename);
    } else {
        const elem = window.document.createElement('a');
        elem.href = window.URL.createObjectURL(blob);
        elem.download = filename;
        document.body.appendChild(elem);
        elem.click();
        document.body.removeChild(elem);
    }
}

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
    map_max_width = term_columns - map_column - 1;
    if (map_width > map_max_width || map_height > term.rows) {
        resizeMap(pos);
    }
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
            term.write('\x1B[2J');
            setMapSize(e.cols);
            ws.send(JSON.stringify(['map_size', [map_max_width, term.rows - 1], {}]));
        } else {
            ws.send(JSON.stringify(['term_size', [e.cols, e.rows], {}]));
        }
    }
});

const max_len = 128;
let history = [];
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
let map = [];  // current map, split into lines
let pos = [];  // last position sent for map
let legend = [];  // current map legend, split into lines
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
            wrapWrite(clearBuffer() + prompt + start + text + '\x1B7' + end + '\x1B8');
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
        wrapWrite(update);
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
    wrapWrite(update);
}

function onCommand() {
    // this is for internal commands like :help
    let update = '';
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
    update += clearBuffer() + command_color + command + reset + '\n';
    wrapWrite(update);
    last_dir = 1;
    enter_pressed = true;
    cursor_pos = 0;
    completion = '';
    handle_command(command);
    command = '';
    wrapWrite(prompt);
}

function onEnter() {
    if (command !== '') {
        if (command[0] === ':') {
            onCommand();
            return;
        }
        let update = '';
        const lines = command.split('\n');
        if (censor_input) {
            ws.send(JSON.stringify(['text', [command], {}]));
            if (lines.length > 1 && cursor_pos > lines[0].length) {
                update += '\x9B' + (lines.length - 1) + 'F';
            }
            update += clearBuffer() + '\n';
            cursor_pos = 0;
            command = '';
            wrapWrite(update);
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
        if (map_enabled) {
            update += clearMap() + clearBuffer() + command_color + command + reset + '\n' + writeMap();
        }else {
            update += clearBuffer() + command_color + command + reset + '\n';
        }
        wrapWrite(update);
        last_dir = 1;
        enter_pressed = true;
        cursor_pos = 0;
        completion = '';
        ws.send(JSON.stringify(['text', [command], {}]));
    }
}

function onDelete() {
    if (cursor_pos < command.length) {
        const sub = command.substring(cursor_pos + 1);
        command = command.substring(0, cursor_pos) + sub;
        wrapWrite(clearBuffer() + prompt + '\x1B7' + command + '\x1B8\r\x9B' + (cursor_pos + prompt_len) + 'C');
    }
}

function onBackspace() {
    if (command.length !== 0 && cursor_pos > 0) {
        const lines = command.split('\n');
        if (lines.length > 1) {
            if (cursor_pos > lines[0].length) {
                // move cursor up if necessary
                wrapWrite('\x9B' + (lines.length - 1) + 'F' + clearBuffer() + prompt);
            } else {
                wrapWrite(clearBuffer() + prompt);
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
        if (cursor_pos !== 0) {
            const result = getCompletion(command);
            if (result[0]) {
                const c = result[1].substring(command.length);
                completion = c;
                update += '\x1B7' + grey + c + reset + '\x1B8';
            } else {
                completion = '';
            }
        } else {
            completion = '';
        }
        wrapWrite(update);
    }
}

function onArrowRight() {
    if (completion.length > 0 && cursor_pos === command.length) {
        command = command.concat(completion);
        wrapWrite(clearBuffer() + prompt + command);
        cursor_pos += completion.length;
        completion = '';
        return;
    }
    const lines = command.split('\n');
    if ((lines.length > 1 && cursor_pos < lines[0].trim().length) || (lines.length === 1 && cursor_pos < command.length)) {
        cursor_pos += 1;
        completion = '';
        // rewrite the whole thing to remove highlight if necessary
        wrapWrite(clearBuffer() + prompt + '\x1B7' + command + '\x1B8\r\x9B' + (cursor_pos + prompt_len) + 'C');
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
        wrapWrite('\x9B' + (lines.length - 1) + 'F' + clearBuffer() + prompt + command);
    } else {
        wrapWrite(clearBuffer() + prompt + command);
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
            wrapWrite('\x9B' + (lines.length - 1) + 'F' + clearBuffer() + prompt + command);
        } else {
            wrapWrite(clearBuffer() + prompt + command);
        }
        cursor_pos = command.length;
        last_dir = 1;
    } else if (cursor_pos !== 0) { // we're at the bottom of history, clear it
        if (lines.length > 1 && cursor_pos > lines[0].length) {
            wrapWrite('\x9B' + (lines.length - 1) + 'F' + clearBuffer() + prompt);
        } else {
            wrapWrite(clearBuffer() + prompt);
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
                wrapWrite('\x9B' + (lines.length - 1) + 'F' + clearBuffer() + prompt);
            } else {
                wrapWrite(clearBuffer() + prompt);
            }
            cursor_pos = 0;
            command = '';
        } else {
            cursor_pos -= 1;
            wrapWrite('\x9B1D');
        }
    }
}

function onHome() {
    if (cursor_pos > 0) {
        cursor_pos = 0;
        wrapWrite(clearBuffer() + prompt + '\x1B7' + command + '\x1B8\r\x9B' + prompt_len + 'C');
    }
}

function onEnd() {
    if (cursor_pos < command.length) {
        const lines = command.split('\n');
        if (lines.length > 0) {
            // for multi-line commands, go to end of first line.  proper multi-line editing might be added later...
            wrapWrite(clearBuffer() + prompt + '\x1B7' + command + '\x1B8\r\x9B' + (prompt_len + lines[0].length) + 'C');
            cursor_pos = lines[0].length;
        } else {
            wrapWrite(clearBuffer() + prompt + command);
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
        wrapWrite(clearBuffer() + prompt);
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
            wrapWrite(clearBuffer() + prompt + start + d + '\x1B7' + end + '\x1B8');
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
    wrapWrite(d);
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
        update += '\x9B' + (i + 1) + ';' + (map_column + 1) + 'H\x1B[0K';
    }
    update += '\x1B8';  // restore cursor
    return update;
}



function writeMap() {
    let update = '';
    let y = 2; // for centering vertically
    update += '\x1B7';  // save cursor
    let pre_pad = '';  // for centering horizontally
    let pad_height = Math.floor((term.rows - legend.length - map_height - 1) / 2);
    if (pad_height > 0) {
        y += pad_height;
    }
    let pre_pad_len = Math.floor((map_max_width - map_width) / 2);
    if (pre_pad_len > 0) {
        pre_pad = ' '.repeat(pre_pad_len);
    }
    for (let i = 0; i < map.length; i++) {
        update += '\x9B' + (i + y) + ';' + (map_column + 1) + 'H' + pre_pad + map[i];
    }
    if (legend.length > 0) {
        y += map.length;
        pre_pad_len = Math.floor((map_max_width - legend[legend.length - 1].length) / 2);
        pre_pad = '';
        if (pre_pad_len > 0) {
            pre_pad = ' '.repeat(pre_pad_len);  // center legend separately
        }
        for (let i = 0; i < legend.length; i++) {
            update += '\x9B' + (i + y) + ';' + (map_column + 1) + 'H' + pre_pad + legend[i];
        }
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

// term.onWriteParsed(e => onWriteParsed(e));
term.onData(e => onData(e));
term.attachCustomKeyEventHandler(e => onKey(e));
term.open(el_terminal);
fitAddon.fit();
ws.onopen = function () {
    wrapWrite('\n======== Connected.\n');
    ws_ready = true;
    ws.send(JSON.stringify(['term_size', [term.cols, term.rows], {}]));
};
ws.onclose = function () {
    wrapWrite('\n======== Connection lost.\n');
    ws_ready = false;
    if (autosave_setting) {
        save();
    }
};

function trimANSIstart(input, len) {
    // trim len chars from start of ANSI string
    let trim_start = 0;
    let is_ansi = false;
    for (let i = 0; i < input.length; i++) {
        if (len === 0) {
            break;
        }
        if (is_ansi) {
            if (input[i] === 'm' || input[i] === 'K') {
                is_ansi = false;
            }
        } else {
            if (input[i] === '\x1b') {
                is_ansi = true;
            } else {
                trim_start = i + 1;
                len--;
            }
        }
    }
    return input.substring(trim_start);
}

function trimANSI(input, maxlen) {
    // trim ANSI string to maxlen while ignoring control codes
    let trim_end = 0;
    let len = 0;
    let is_ansi = false;
    for (let i = 0; i < input.length; i++) {
        if (len === maxlen) {
            break;
        }
        if (is_ansi) {
            if (input[i] === 'm' || input[i] === 'K') {
                is_ansi = false;
            }
        } else {
            if (input[i] === '\x1b') {
                is_ansi = true;
            } else {
                trim_end = i + 1;
                len++;
            }
        }
    }
    return input.substring(0, trim_end);
}

function ANSIsubstring(input, start, end) {
    // get substring of ANSI string while ignoring control codes
    let pos = 0;
    let start_pos = 0;
    let end_pos = 0;
    let is_ansi = false;
    for (let i = 0; i < input.length; i++) {
        if (pos === end) {
            break;
        }
        if (is_ansi) {
            if (input[i] === 'm' || input[i] === 'K') {
                is_ansi = false;
            }
        } else {
            if (input[i] === '\x1b') {
                is_ansi = true;
            } else {
                if (pos < start) {
                    start_pos = i + 1;
                }
                if (pos < end) {
                    end_pos = i + 2;
                }
                pos++;
            }
        }
    }
    if (start_pos <= end_pos) {
        return input.substring(start_pos, end_pos);
    }
    return '';
}

function resizeMap(pos) {
    // resize map if it's too big...supports color
    // pos = [x,y] coordinate that should be visible
    const x = Math.min(Math.max(pos[0], 0), map_width)
    let y = Math.min(Math.max(pos[1], 0), map_height)
    let xstart = 0, xend = 0, ystart = 0, yend = 0;
    if (map_width - map_max_width > 0) {
        const lil_half = Math.floor(map_max_width / 2);
        const half_diff = map_max_width - (lil_half * 2);
        if (x <= lil_half + half_diff) {
            xstart = Math.max(x - lil_half, 0);
            xend = Math.min(xstart + map_max_width - 1, map_width - 1);
        } else {
            xend = Math.min(x + lil_half, map_width);
            xstart = Math.max(xend - map_max_width, 0);
        }
        for (let i = 0; i < map.length; i++) {
            map[i] = ANSIsubstring(map[i], xstart, xend)
        }
        map_width = map_max_width;
    }
    if ((map_height + legend.length) - term.rows > 0) {
        const max_height = term.rows - legend.length - 1;
        const half_max = Math.floor(max_height / 2);
        y = map.length - y;
        let start = Math.max(y - half_max, 0);
        let end = Math.min(y + half_max, map.length);
        if (end - start < max_height) {
            let diff = max_height - (end - start);
            if (start > 0) {
                if (start >= diff) {
                    start -= diff;
                    diff = 0;
                } else {
                    start = 0;
                    diff -= start;
                }
            }
            if (diff > 0 && end < map.length) {
                end = Math.min(end + diff, map.length);
            }
        }
        map = map.slice(start, end);
        map_height = term.rows;
    }
}

function onText(input) {
    let update = '';
    update += clearBuffer();
    if (map_enabled) {
        update += clearMap() + wrap(input) + reset + writeMap();
    } else {
        update += input + reset;
    }
    update += prompt;
    if (command.length > 0 && completion.length === 0) {
        update += '\x1B7' + highlight + command + reset + '\x1B8';
        wrapWrite(update);
        return;
    } else if (completion.length > 0) {
        update += highlight + command + reset;
        update += grey + completion + reset + '\x9B' + completion.length + 'D';
    }
    wrapWrite(update);
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

const sleep = (delay) => new Promise((resolve) => setTimeout(resolve, delay))

async function onMessage(e) {
    let msg = JSON.parse(e.data);
    switch (msg[0]) {
        case 'text':
            onText(msg[1][0]);
            break;
        case 'raw_text':  // default text messages get \n appended to them before being sent, this doesn't
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
            wrapWrite('\x1B7'); // save cursor
            break;
        case 'interactive_end':
            interactive_mode = false;
            wrapWrite('\x1B8'); // restore cursor
            break;
        case 'player_commands':
            player_commands.push(...msg[1]);
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
                // map = msg[1].split(/\r?\n/);
                map = msg[2].map.split(/\r?\n/);
                pos = msg[2].pos
                legend = msg[2].legend.split(/\r?\n/);
                // strip ANSI before checking width
                const stripped = msg[2].map.replace(ansi_color_regex, '').split(/\r?\n/);
                // figure out map width so it can be centered
                map_width = 0;
                map_height = map.length;
                for (let i = 0; i < stripped.length; i++) {
                    if (stripped[i].length > map_width) {
                        map_width = stripped[i].length;
                    }
                }
                if (map_width > map_max_width || (map_height + legend.length) > term.rows) {
                    resizeMap(pos);
                }
                wrapWrite(clearMap() + writeMap());
            }
            break;
        case 'buffer':
            // this is for writing buffers with flow control
            // this command expects an array of strings to write sequentially to the terminal
            let x = 0;
            async function next() {
                x += 1;
                if (x >= msg[1].length) {
                    wrapWrite(reset + '\x1B[?25h\n');
                } else {
                    // slow down buffer playback if necessary
                    //await sleep(0);
                    wrapWrite(msg[1][x], next);
                }
            }
            wrapWrite(msg[1][x], next)
            break;
        default:
            console.log('Unknown command: ' + msg);
    }
}

ws.addEventListener("message", e => onMessage(e));
ws.onerror = function (e) {
    console.log(e);
    wrapWrite('\n======== Connection error: ' + e + '\n');
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
        wrapWrite(clearMap(), () => {
            fitAddon.fit();
            wrapWrite(writeMap());
        });
    } else {
        fitAddon.fit();
    }
}, true);