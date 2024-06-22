
let ws_ready = false;
let ws = new WebSocket(wsurl + '?' + csessid);
const term = new Terminal({
    convertEol: true,
    allowProposedApi: true,
    disableStdin: true,
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

// const el_container = document.getElementById('container');
const el_terminal = document.getElementById('terminal');
let audio = new Audio();
term.onResize(e => {
    if (ws_ready) {
        ws.send(JSON.stringify(['term_size', [e.cols, e.rows], {}]));
    }
});
// term.onData(e => {
//     console.log(data);
// });

const max_len = 128;
let history = [];
let player_commands = [];
let command = '';
let completion = '';
let index = 0;
let last_index = -2;
let interactive_mode = false;
const grey = '\x1B[38;5;243m';
const reset = '\x1B[0m';
const command_color = '\x1B[38;5;220m';
let cursor_pos = 0;

function logStuff(from) {
    console.log(from);
    console.log('cursor_pos = ' + cursor_pos);
    console.log('index = ' + index);
    console.log('last_index = ' + last_index);
    console.log('command = ' + command);
    console.log('history = ' + history);
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
function onKey(e) {
    switch (e.domEvent.key) {
        case 'Enter':
            if (interactive_mode) {
                ws.send(JSON.stringify(['interact', [e.key], {}]));
                term.write(e.key);
                break;
            }
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
                term.write(command_color+command+reset+'\n');
                last_index = -2;
                command = '';
                cursor_pos = 0;
            }
            break;
        case 'Tab':
            if (interactive_mode) {
                ws.send(JSON.stringify(['interact', [e.key], {}]));
                term.write(e.key);
                break;
            }
            if (completion.length > 0) {
                cursorBack(completion.length);
                term.write(completion);
                command = command.concat(completion);
                completion = '';
            }
          break;
        case 'Delete':
            // TODO
            break;
        case 'Backspace':
            if (interactive_mode) {
                break;
            }
            if (completion.length > 0) {
                cursorBack(completion.length);
                completion = '';
            }
            if (command.length !== 0 && cursor_pos > 0) {
                // backspace can be in the middle of a line
                // command = command.slice(0, -1);
                sub = command.substring(cursor_pos);
                command = command.substring(0, cursor_pos - 1) + sub;
                cursorBack(1);
                cursor_pos -= 1;
                // write the end of the now-shortened command and move the cursor back
                term.write(sub+'\x9B1D');
            }
            break;
        case 'ArrowRight':
            if (interactive_mode) {
                ws.send(JSON.stringify(['interact', [e.key], {}]));
                term.write(e.key);
                break;
            }
            if (completion.length > 0) {
                cursorBack(completion.length);
                term.write(completion);
                command = command.concat(completion);
                completion = '';
            }
            else if (cursor_pos !== command.length) {
                //cursor is being moved
                cursor_pos += 1;
                term.write(e.key);
            }
            break;
        case 'ArrowUp':
            if (interactive_mode) {
                ws.send(JSON.stringify(['interact', [e.key], {}]));
                term.write(e.key);
                break;
            }
            if (index - 1 >= 0 && index === last_index && last_index !== -1) {
                index -= 1;
            }
            if (index !== last_index) {
                if (index === -1) {
                    index = history.length - 1;
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
                last_index = index;
            }
            break;
        case 'ArrowDown':
            if (interactive_mode) {
                ws.send(JSON.stringify(['interact', [e.key], {}]));
                term.write(e.key);
                break;
            }
            if (completion.length > 0) {
                    cursorBack(completion.length);
                    completion = '';
                }
            if (index === -1){
              break;
            }
            if (index + 1 <= history.length - 1 && last_index === index) {
                index += 1;
            }
            if (index === history.length - 1 && last_index === index) {
                cursorBack(command.length);
                command = '';
                index = -1;
                break;
            }
            if (index !== last_index) {
                cursorBack(command.length);
                command = history[index];
                term.write(command);
                last_index = index;
            }
            break;
        case 'ArrowLeft':
            if (interactive_mode) {
                ws.send(JSON.stringify(['interact', [e.key], {}]));
                term.write(e.key);
                break;
            }
            if (completion.length > 0) {
                    cursorBack(completion.length);
                    completion = '';
                }
            if (cursor_pos > 0) {
                cursor_pos -= 1;
                term.write(e.key);
            }
            break;
        default:
            console.log(e);
            if (interactive_mode) {
                ws.send(JSON.stringify(['interact', [e.key], {}]));
                term.write(e.key);
                break;
            }
            //command = command.concat(e.key);
            command = command.substring(0, cursor_pos) + e.key + command.substring(cursor_pos);
            cursor_pos += 1;
            index = history.length - 1;
            // insert characters after left arrow has been pressed
            if (cursor_pos !== command.length) {
                const sub = command.substring(cursor_pos);
                // overwrite command from new position and move the cursor back
                term.write(e.key+sub+'\x9B'+sub.length+'D');
                break;
            }
            const result = getCompletion(command);
            if (result[0]) {
                if (completion.length > 0) {
                    cursorBack(completion.length);
                }
                const str = result[1].substring(command.length);
                completion = str;
                term.write(e.key + grey + str + reset);
            } else {
                if (completion.length > 0) {
                    cursorBack(completion.length);
                }
                completion = '';
                term.write(e.key);
            }
    }
}

term.onKey(e => onKey(e));
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
    // console.log(e.data);
    let msg = JSON.parse(e.data);
    switch (msg[0]) {
        case 'text':
            term.write(msg[1][0]);
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