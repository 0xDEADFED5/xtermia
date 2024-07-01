let ws_ready = false;
let ws = new WebSocket(wsurl + '?' + csessid);
const term = new Terminal({
    convertEol: true,
    allowProposedApi: true,
    disableStdin: false,
    fontFamily: '"Fira Code", Menlo, monospace',
    fontSize: 19,
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
let index = -1;
let last_dir = 0; // 0 = none, 1 = down, 2 = up
let interactive_mode = false;
let cursor_x = 0;  // these are used during interactive mode to keep track of relative cursor position
let cursor_y = 0;
let self_paste = false; // did we send the paste? or is the right-click menu being used?
let self_write = false; // if true, don't do onData events
let command_sent = false;  // this is used to figure out if we just sent a command and should display prompt
let enter_pressed = false;
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

function cursorBack(len) {
    if (len > 0) {
        const back = '\x9B' + len + 'D';
        const del = '\x9B' + len + 'P';
        term.write(back + del);
    }
}

function del(len) {
    if (len > 0) {
        term.write('\x9B' + len + 'P');
    }
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
            del(completion.length);
        }
        const str = result[1].substring(command.length);
        completion = str;
        // write new typed char + grey completion, reset color, move the cursor back
        term.write(e + grey + str + reset + '\x9B' + str.length + 'D');
    } else {
        if (completion.length > 0) {
            del(completion.length);
        }
        completion = '';
        term.write(e);
    }
}

function onEnter() {
    if (command !== '') {
        command_sent = true;
        ws.send(JSON.stringify(['text', [command], {}]));
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
        if (completion.length > 0) {
            del(completion.length);
            completion = '';
        }
        if (prompt.length > 0) {
            cursorBack(prompt.length);
        }
        cursorBack(command.length);
        term.write(command_color + command + reset + '\r\n');
        last_dir = 0;
        enter_pressed = true;
        cursor_pos = command.length;
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
        del(completion.length);
        completion = '';
    }
    if (command.length !== 0 && cursor_pos > 0) {
        // backspace can be in the middle of a line
        const sub = command.substring(cursor_pos);
        command = command.substring(0, cursor_pos - 1) + sub;
        cursor_pos -= 1;
        // move cursor back, write shortened command + ' ', move cursor back
        term.write('\x9B1D' + sub + ' ' + '\x9B' + (sub.length + 1) + 'D');
    }
}

function onArrowRight() {
    if (completion.length > 0) {
        del(completion.length);
        term.write(completion);
        command = command.concat(completion);
        cursor_pos += completion.length;
        completion = '';
    } else if (cursor_pos < command.length - 1) {
        cursor_pos += 1;
        term.write('\x9B1C');
    }
}

function onArrowUp() {
    if (index === -1) {
        return;
    } else if (last_dir !== 0 && index > 0) {
        index -= 1;
    }
    if (completion.length > 0) {
        del(completion.length);
    }
    cursorBack(cursor_pos);
    command = '';
    command = history[index];
    term.write(command);
    cursor_pos = command.length;
    last_dir = 2;
}

function onArrowDown() {
    if (index < history.length - 1) {
        index += 1;
        cursorBack(cursor_pos);
        completion = '';
        command = history[index];
        term.write(command);
        cursor_pos = command.length;
        last_dir = 1;
    } else if (cursor_pos !== 0) { // we're at the bottom of history, clear it
        cursorBack(cursor_pos);
        command = '';
        completion = '';
        cursor_pos = 0;
        last_dir = 0;
    }
}

function onArrowLeft() {
    if (cursor_pos > prompt.length - 1) {
        if (completion.length > 0) {
            del(completion.length);
            completion = '';
        }
        cursor_pos -= 1;
        term.write('\x9B1D');
    }
}

function onHome() {
    if (cursor_pos > 0) {
        term.write('\x9B' + cursor_pos + 'D');
        cursor_pos = 0;
    }
}

function onEnd() {
    if (cursor_pos < command.length) {
        term.write('\x9B' + (command.length - cursor_pos) + 'C');
        cursor_pos = command.length;
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
        cursorBack(command.length);
        command = '';
        cursor_pos = 0;
    }
    if (control_down && c_down && !action_done) {
        navigator.clipboard.writeText(term.getSelection());
        action_done = true;
        return false;
    } else if (control_down && v_down && !action_done) {
        self_paste = true;
        doPaste();
        action_done = true;
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
            const sub = command.substring(cursor_pos);
            command = command.substring(0, cursor_pos) + d + sub;
            if (completion.length > 0) {
                cursorBack(completion.length);
                completion = '';
            }
            term.write(d + sub);
            cursor_pos += d.length;
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
    if (y > 0) {
        writeSelf('\x9B' + y + 'A'); // cursor up N
    } else if (y < 0) {
        writeSelf('\x9B' + (y * -1) + 'B'); // cursor down N
    }
    if (x > 0) {
        writeSelf('\x9B' + x + 'C'); // cursor forward N
    } else if (x < 0) {
        writeSelf('\x9B' + (x * -1) + 'D'); // cursor back N
    }
    cursor_x = x;
    cursor_y = y;
}

function writeSelf(d, insert = false) {
    if (interactive_mode) {
        self_write = true;
        term.write(d);
        if (insert) {
            term.write('\x9B' + d.length + 'D'); // cursor back N
        }
    } else {
        term.write(d);
    }
}

function cursorHome() {
    // move cursor to where it was when interactive_mode started
    if (cursor_x > 0) {
        writeSelf('\x9B' + cursor_x + 'D');
    } else if (cursor_x < 0) {
        writeSelf('\x9B' + (cursor_x * -1) + 'C');
    }
    if (cursor_y > 0) {
        writeSelf('\x9B' + cursor_y + 'B');
    } else if (cursor_x < 0) {
        writeSelf('\x9B' + (cursor_y * -1) + 'A');
    }
    cursor_x = 0;
    cursor_y = 0;
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
            // move the prompt, command buffer, and completion text after whatever we just received
            if (completion.length > 0) {
                del(completion.length);
            }
            if (prompt.length > 0) {
                cursorBack(prompt.length);
            }
            if (command.length > 0) {
                cursorBack(command.length);
            }
            term.write(msg[1][0] + reset + prompt + command);
            if (completion.length > 0) {
                term.write(grey + completion + reset + '\x9B' + completion.length + 'D');
            }
            break;
        case 'raw_text':  // default text messages get /r/n appended to them before being sent, this doesn't
            writeSelf(msg[1][0]);
            break;
        case 'insert_text':  // print raw_text and move the cursor back
            writeSelf(msg[1][0], true);
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
            cursorHome();
            break;
        case 'clear_line':
            /* command signature: clear_line=row
              moves cursor to line relative from where interactive_start was sent and clears it.
              cursor is then moved back to where it was.
              positive values go up, negative go down, and 0 clears the current line */
            cursorHome();
            if (msg[1][0] > 0) {
                writeSelf('\x9B' + msg[1][0] + 'A');
            } else if (msg[1][0] < 0) {
                writeSelf('\x9B' + (msg[1][0] * -1) + 'B');
            }
            cursor_y += msg[1][0];
            writeSelf('\x9B2K'); // clear line
            cursorHome();
            break;
        case 'pos_cursor':
            // move cursor to relative position from where interactive_start was issued, same rules as below
            // command signature: pos_cursor=[row, column]
            relPos(msg[1][0], msg[1][1]);
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
            cursorHome();
            relPos(msg[1][0], msg[1][1]);
            writeSelf(msg[1][2], true);
            relPos(old_x, old_y);
            cursor_x = old_x;
            cursor_y = old_y;
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
            cursor_x = 0;
            cursor_y = 0;
            term.write('\x9Bs'); // save cursor
            break;
        case 'interactive_end':
            interactive_mode = false;
            term.write('\x9Bu'); // restore cursor
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