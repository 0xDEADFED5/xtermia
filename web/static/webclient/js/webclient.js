let ws_ready = false;
let ws = new WebSocket(wsurl + '?' + csessid);
const term = new Terminal({
    convertEol: true,
    allowProposedApi: true,
    disableStdin: false,
    fontFamily: '"Fira Code", Menlo, monospace',
    fontSize: 18,
    cursorBlink: true
});

const unicode11Addon = new Unicode11Addon.Unicode11Addon();
term.loadAddon(unicode11Addon);
term.unicode.activeVersion = '11';

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
term.onResize(e => {
    if (ws_ready) {
        ws.send(JSON.stringify(['term_size', [e.cols, e.rows], {}]));
    }
});

const max_len = 128;
let history = [];
let player_commands = [];
let command = '';
let completion = '';
let prompt = '';
let index = 0;
let last_dir = 0; // 0 = none, 1 = down, 2 = up
let interactive_mode = false;
const grey = '\x1B[38;5;243m';
const reset = '\x1B[0m';
const command_color = '\x1B[38;5;220m';
let cursor_pos = 0;

function doPaste() {
    navigator.clipboard.readText()
        .then(text => {
            const sub = command.substring(cursor_pos);
            command = command.substring(0, cursor_pos) + text + sub;
            if (completion.length > 0) {
                cursorBack(completion.length);
                completion = '';
            }
            term.write(text + sub);
            cursor_pos += text.length;
        })
        .catch(err => {
            console.log('Clipboard error: ', err);
        });
}

function getCompletion(c) {
    for (let i = 0; i < history.length; i++) {
        if (history[i].length > c.length && history[i].startsWith(c)) {
            return [true, history[i]]
        }
    }
    for (let i = 0; i < player_commands.length; i++) {
        if (player_commands[i].length > c.length && player_commands[i].startsWith(c)) {
            return [true, player_commands[i]]
        }
    }
    return [false]
}

function cursorBack(len) {
    const back = '\x9B' + len + 'D';
    const del = '\x9B' + len + 'P';
    term.write(back + del);
}

function onDefault(e) {
    command = command.substring(0, cursor_pos) + e + command.substring(cursor_pos);
    cursor_pos += 1;
    index = history.length - 1;
    last_dir = 0;
    // insert characters after left arrow has been pressed
    if (cursor_pos !== command.length) {
        const sub = command.substring(cursor_pos);
        // overwrite command from new position and move the cursor back
        term.write(e + sub + '\x9B' + sub.length + 'D');
        return;
    }
    const result = getCompletion(command);
    if (result[0]) {
        if (completion.length > 0) {
            cursorBack(completion.length);
        }
        const str = result[1].substring(command.length);
        completion = str;
        term.write(e + grey + str + reset);
    } else {
        if (completion.length > 0) {
            cursorBack(completion.length);
        }
        completion = '';
        term.write(e);
    }
}

function onEnter() {
    if (command !== '') {
        ws.send(JSON.stringify(['text', [command], {}]));
        if (history.length > max_len) {
            history.shift();
        }
        if (!history.includes(command)) {
            index = history.push(command) - 1;
        } else {
            index = history.indexOf(command);
        }
        if (completion.length > 0) {
            cursorBack(completion.length);
            completion = '';
        }
        cursorBack(command.length);
        term.write(command_color + command + reset + '\r\n');
        last_dir = 0;
        command = '';
        cursor_pos = 0;
    }
}

function onTab() {
    if (completion.length > 0) {
        cursorBack(completion.length);
        term.write(completion);
        command = command.concat(completion);
        completion = '';
    }
}

function onDelete() {
    if (cursor_pos < command.length) {
        if (command.length - cursor_pos === 1) {
            command = command.slice(0, -1);
            term.write(' \x9B1D');  // print a space to cover it up, move the cursor back
        } else {
            const sub = command.substring(cursor_pos + 1);
            command = command.substring(0, cursor_pos) + sub;
            // shorten the current command, print it, add space to hide the last char, move cursor back
            term.write(sub + ' ' + '\x9B' + (sub.length + 1) + 'D');
        }
    }
}

function onBackspace() {
    if (completion.length > 0) {
        cursorBack(completion.length);
        completion = '';
    }
    if (command.length !== 0 && cursor_pos > 0) {
        // backspace can be in the middle of a line
        const sub = command.substring(cursor_pos);
        command = command.substring(0, cursor_pos - 1) + sub;
        cursor_pos -= 1;
        // move cursor back, write shortened command + ' ', move cursor back
        term.write('\x9B1D' + sub + ' ' + '\x9B1D');
    }
}

function onArrowRight() {
    if (completion.length > 0) {
        cursorBack(completion.length);
        term.write(completion);
        command = command.concat(completion);
        completion = '';
    } else if (cursor_pos !== command.length) {
        //cursor is being moved
        cursor_pos += 1;
        term.write('\x9B1C');
    }
}

function onArrowUp() {
    if (index === 0) {
        return;
    }
    else if (last_dir !== 0) {
        index -= 1;
    }
    if (command.length > 0) {
        cursorBack(command.length);
        command = '';
    }
    if (completion.length > 0) {
        cursorBack(completion.length);
        completion = '';
    }
    command = history[index];
    term.write(command);
    last_dir = 2;
}

function onArrowDown() {
    if (index < history.length - 1) {
        index += 1;
        if (command.length > 0) {
            cursorBack(command.length);
            command = '';
        }
        if (completion.length > 0) {
            cursorBack(completion.length);
            completion = '';
        }
        command = history[index];
        term.write(command);
        last_dir = 1;
    }
    else { // we're at the bottom of history, clear it
        if (command.length > 0) {
            cursorBack(command.length);
            command = '';
        }
        if (completion.length > 0) {
            cursorBack(completion.length);
            completion = '';
        }
        last_dir = 0;
    }
}

function onArrowLeft() {
    if (completion.length > 0) {
        cursorBack(completion.length);
        completion = '';
    }
    if (cursor_pos > 0) {
        cursor_pos -= 1;
        term.write('\x9B1D');
    }
}

let control_down = false;
let c_down = false;
let v_down = false;
let arrow_left_down = false;
let arrow_right_down = false;
let arrow_up_down = false;
let arrow_down_down = false;
let action_done = false;

function onKey(e) {
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
                    arrow_left_down = true;
                    onArrowLeft();
                    return false;
                case 'ArrowRight':
                    arrow_right_down = true;
                    onArrowRight();
                    return false;
                case 'ArrowUp':
                    arrow_up_down = true;
                    onArrowUp();
                    return false;
                case 'ArrowDown':
                    arrow_down_down = true;
                    onArrowDown();
                    return false;
                case 'Home':
                    if (cursor_pos !== 0) {
                        term.write('\x9B' + cursor_pos + 'D');
                        cursor_pos = 0;
                    }
                    return false;
                case 'End':
                    if (cursor_pos !== command.length) {
                        term.write('\x9B' + (command.length - cursor_pos) + 'C');
                        cursor_pos = command.length;
                    }
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
                case 'ArrowLeft':
                    arrow_left_down = false;
                    return false;
                case 'ArrowRight':
                    arrow_right_down = false;
                    return false;
                case 'ArrowUp':
                    arrow_up_down = false;
                    return false;
                case 'ArrowDown':
                    arrow_down_down = false;
                    return false;
                default:
                    break;
            }
            action_done = false;
            break;
        default:
            break;
    }
    if (control_down && c_down && !action_done) {
        navigator.clipboard.writeText(term.getSelection());
        action_done = true;
        return false;
    } else if (control_down && v_down && !action_done) {
        doPaste();
        action_done = true;
        return false;
    }
    return true;
}

function onData(d) {
    if (interactive_mode) {
        ws.send(JSON.stringify(['interact', [d], {}]));
        term.write(d);
        return;
    }
    if (d.length !== 1) {
        // paste event probably, skip it
        return;
    }
    const ord = d.charCodeAt(0);
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
                onArrowRight()
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
                onTab();
                break;
            case '\x03': // CTRL+C
                // term.getSelection() doesn't work from here ??
                // handle in onKey instead
                break;
            case '\x16': // CTRL+V
                // handle in onKey instead
                break;
        }

    } else {
        onDefault(d);
    }
}

term.onData(e => onData(e));
// term.onKey(e => onKey(e));
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
ws.onmessage = function (e) {
    let msg = JSON.parse(e.data);
    switch (msg[0]) {
        case 'text':
            term.write(msg[1][0] + prompt);
            break;
        case 'prompt':
            prompt = msg[1][0];
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
            break;
        case 'interactive_start':
            interactive_mode = true;
            break;
        case 'interactive_end':
            interactive_mode = false;
            break;
        case 'player_commands':
            player_commands = msg[1];
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
// window.addEventListener('scroll', function (e) {
//     window.scrollTo(0, 0);
//     fitAddon.fit();
//     e.preventDefault();
//     e.stopPropagation();
// });
//
// window.addEventListener('touchmove', function (e) {
//     e.preventDefault();
//     e.stopPropagation();
// });
window.addEventListener('resize', function (e) {
    fitAddon.fit();
});