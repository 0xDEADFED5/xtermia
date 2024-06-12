// heavily based on https://github.com/fluffos/fluffos/tree/master/src/www/example.js
// with some pieces from https://github.com/evennia/evennia/blob/main/evennia/web/static/webclient/js/evennia.js
/**
 * Determine the mobile operating system.
 *
 * @returns {Boolean}
 */
function isMobile() {
  const userAgent = navigator.userAgent || navigator.vendor || window.opera;
  // Windows Phone must come first because its UA also contains "Android"
  if (/windows phone/i.test(userAgent)) {
    return true;
  }

  if (/android/i.test(userAgent)) {
    return true;
  }

  // iOS detection from: http://stackoverflow.com/a/9039885/177710
  if (/iPad|iPhone|iPod/.test(userAgent) && !window.MSStream) {
    return true;
  }

  return false;
}

const WebFontSize = 18;
const MobileFontSize = 9;
const term = new Terminal({
  convertEol: true,
  allowProposedApi: true,
  disableStdin: true,
  fontFamily: '"Fira Code", Menlo, monospace',
  fontSize: isMobile() ?  MobileFontSize: WebFontSize
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

//const weblinksAddon = new WebLinksAddon.WebLinksAddon();
//term.loadAddon(weblinksAddon);

let history = [];
let history_index = -1;
let current_command = "";

function onload() {
  const el_container = document.getElementById('container');
  const el_terminal = document.getElementById('terminal');
  const el_input = document.getElementById('command');
  let audio = new Audio();
  window.addEventListener('scroll', function(e) {
    window.scrollTo(0,0);
    fitAddon.fit();
    e.preventDefault();
    e.stopPropagation();
  });

  window.addEventListener('touchmove', function(e) {
    e.preventDefault();
    e.stopPropagation();
  });

  window.addEventListener('resize', function (e) {
    fitAddon.fit();
  });

  if(isMobile()) {
    el_container.style.height = "50vh";
    fitAddon.fit();
  } else {
    el_container.style.height = $(window).height();
    fitAddon.fit();
  }

  el_input.setAttribute("disabled", "disabled");
  el_input.style.fontFamily = '"Fira Code", Menlo, monospace'
  el_input.style.fontSize = isMobile() ?  MobileFontSize: WebFontSize + "px";
  term.open(el_terminal);
  fitAddon.fit();
  const browser = (function (agent) {
    "use strict"
    switch (true) {
      case agent.indexOf("edge") > -1:
        return "edge";
      case agent.indexOf("edg") > -1:
        return "chromium based edge (dev or canary)";
      case agent.indexOf("opr") > -1 && !!window.opr:
        return "opera";
      case agent.indexOf("chrome") > -1 && !!window.chrome:
        return "chrome";
      case agent.indexOf("trident") > -1:
        return "ie";
      case agent.indexOf("firefox") > -1:
        return "firefox";
      case agent.indexOf("safari") > -1:
        return "safari";
      default:
        return "other";
    }
  })(window.navigator.userAgent.toLowerCase());
  //console.log(window.navigator.userAgent.toLowerCase() + "\n" + browser);
  const wsurl = window.wsurl;
  const csessid = window.csessid;
  const cuid = window.cuid;
  let ws_ready = false;
  const ws = new WebSocket(wsurl + '?' + csessid + '&' + cuid + '&' + browser);
  // const attachAddon = new AttachAddon.AttachAddon(ws);
  // term.loadAddon(attachAddon);
  term.onResize(function (evt) {
    if (ws_ready) {
      ws.send(JSON.stringify(["term_size", [evt.cols, evt.rows], {}]));
    }
  });
  el_input.focus();
  try {
    ws.onopen = function () {
      term.write("\033[9999;1H");
      term.write("\r\n======== Connected.\r\n");
      el_input.removeAttribute("disabled");
      el_input.focus();
      ws_ready = true;
      ws.send(JSON.stringify(["term_size", [term.cols, term.rows], {}]));
    };
    ws.onclose = function () {
      term.write("\033[9999;1H");
      term.write("\r\n======== Connection Lost.\r\n");
      el_input.setAttribute("disabled", "disabled");
      ws_ready = false;
    };
    ws.onmessage = function (e) {
      //console.log(e.data);
      let msg = JSON.parse(e.data);
      if (msg[0] === 'text') {
        term.write(msg[1][0]);
      } else if (msg[0] === 'audio') {
        audio.pause();
        audio.src = msg[1][0];
        audio.play();
      } else if (msg[0] === 'audiopause') {
        audio.pause();
      }
        // else if (msg[0] === 'frame') {
        //   term.write(msg[1][0]);
        //   console.log(audio.currentTime);
        //   if (!audio.paused) {
        //     ws.send(JSON.stringify(["elapsed", [audio.currentTime], {}]));
        //   }
        // }
    };
  } catch (exception) {
    alert("<p>Error " + exception);
  }

  el_input.addEventListener("blur", function(e) {
    e.stopPropagation();
    e.preventDefault();
    el_input.focus();
  });

  el_input.addEventListener("keydown", function(e) {
    if (e.key === "Tab") {
      e.stopPropagation();
      e.preventDefault();
      return ;
    }

    if (e.key === "Enter") {
      if(el_input.value) {
        history.push(el_input.value);
        if (history.length > 64) {
          history.shift();
        }
        history_index = -1;
      }

      var content = el_input.value;
      ws.send(JSON.stringify(["text", [content], {}]));
      // ws.send(JSON.stringify(["oob_echo", ["test"], {}]));
      term.write(content + "\r\n");
      el_input.value = "";

    } else if (e.key === "ArrowUp") {
      e.stopPropagation();
      e.preventDefault();

      // If there is history, show last one
      if(history.length > 0) {
        // remember current command
        if(history_index === -1) {
          current_command = el_input.value;
        }
        if (history_index < history.length - 1) {
          history_index = history_index + 1;
          el_input.value = history[history.length - history_index - 1];
        }
      }
    } else if (e.key === "ArrowDown") {
      e.stopPropagation();
      e.preventDefault();

      if(history_index > -1) {
        history_index = history_index - 1;
        if(history_index >= 0) {
          el_input.value = history[history.length - history_index - 1];
        } else {
          el_input.value = current_command;
        }
      }
    }
  });
}

document.addEventListener("DOMContentLoaded", function () {
  new FontFaceObserver("Fira Code").load().then(function () {
    onload();
  });
}, false);
