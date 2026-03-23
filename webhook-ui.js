const http = require('http');

let logs = [];

const server = http.createServer((req, res) => {
    // CLEAR LOGS
    if (req.url === '/clear' && req.method === 'POST') {
        logs = [];
        res.writeHead(200);
        res.end('cleared');
        return;
    }

    // LOGS ENDPOINT
    if (req.url === '/logs') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(logs));
        return;
    }

    // RECEIVE WEBHOOK
    if (req.method === 'POST') {
        let body = [];

        req.on('data', (chunk) => body.push(chunk));

        req.on('end', () => {
            body = Buffer.concat(body).toString();

            let parsed;
            try {
                parsed = JSON.parse(body);
            } catch {
                parsed = body;
            }

            logs.unshift({
                id: Date.now() + Math.random(),
                time: new Date().toISOString(),
                url: req.url,
                method: req.method,
                headers: req.headers,
                body: parsed,
            });

            if (logs.length > 50) logs.pop();

            res.writeHead(200);
            res.end('OK');
        });

        return;
    }

    // UI PAGE
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`<!DOCTYPE html>
<html>
<head>
    <title>Webhook Inspector</title>
    <meta charset="UTF-8">
    <style>
        body {
            margin: 0;
            background: #0b0b0b;
            color: #00ff9c;
            font-family: monospace;
        }

        .topbar {
            display: flex;
            gap: 10px;
            padding: 10px;
            border-bottom: 1px solid #00ff9c33;
        }

        button {
            background: transparent;
            color: #00ff9c;
            border: 1px solid #00ff9c;
            padding: 6px 12px;
            cursor: pointer;
        }

        button:hover {
            background: #00ff9c;
            color: #000;
        }

        .logs {
            padding: 10px;
        }

        .entry {
            border: 1px solid #00ff9c22;
            margin-bottom: 12px;
            padding: 10px;
        }

        .meta {
            font-size: 12px;
            margin-bottom: 8px;
            color: #00ffaa;
            word-break: break-all;
        }

        .actions {
            margin-bottom: 6px;
        }

        .copy-btn {
            font-size: 12px;
            padding: 2px 6px;
            border: 1px solid #00ff9c55;
            cursor: pointer;
            margin-right: 6px;
        }

        .copy-btn:hover {
            background: #00ff9c;
            color: #000;
        }

        pre {
            background: #000;
            padding: 10px;
            overflow-x: auto;
            white-space: pre-wrap;
            word-break: break-word;
            border: 1px solid #00ff9c22;
            user-select: text;
        }

        .empty {
            opacity: 0.5;
        }

        a {
            color: #00ff9c;
            text-decoration: underline;
        }
    </style>
</head>
<body>

<div class="topbar">
    <button onclick="refreshLogs()">Refresh (r)</button>
    <button onclick="clearLogs()">Clear (c)</button>
</div>

<div class="logs" id="logs"></div>

<script>
let logsData = [];

function format(obj) {
    try {
        return JSON.stringify(obj, null, 2);
    } catch {
        return String(obj);
    }
}

function copy(text) {
    navigator.clipboard.writeText(text);
}

function escapeHtml(text) {
    return text
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;");
}

function linkify(text) {
    const urlRegex = /(https?:\\/\\/[^\\s]+)/g;
    return text.replace(urlRegex, function(url) {
        return '<a href="' + url + '" target="_blank" rel="noopener noreferrer">' + url + '</a>';
    });
}

function render(logs) {
    const container = document.getElementById('logs');
    container.innerHTML = '';

    if (!logs.length) {
        container.innerHTML = '<div class="empty">No logs</div>';
        return;
    }

    logs.forEach((log) => {
        const div = document.createElement('div');
        div.className = 'entry';

        const bodyText = format(log.body);
        const headersText = format(log.headers);

        const safeBody = linkify(escapeHtml(bodyText));
        const safeUrl = linkify(escapeHtml(log.url));

        div.innerHTML = \`
            <div class="meta">
                \${log.time} | \${log.method} | \${safeUrl}
            </div>

            <div class="actions">
                <button class="copy-btn">Copy Body</button>
                <button class="copy-btn">Copy Headers</button>
            </div>

            <pre>\${safeBody}</pre>
        \`;

        const buttons = div.querySelectorAll('.copy-btn');
        buttons[0].onclick = () => copy(bodyText);
        buttons[1].onclick = () => copy(headersText);

        container.appendChild(div);
    });
}

async function refreshLogs() {
    try {
        const res = await fetch('/logs');
        logsData = await res.json();
        render(logsData);
    } catch (e) {}
}

async function clearLogs() {
    await fetch('/clear', { method: 'POST' });
    refreshLogs();
}

setInterval(refreshLogs, 1500);
refreshLogs();

document.addEventListener('keydown', (e) => {
    if (e.key === 'r') refreshLogs();
    if (e.key === 'c') clearLogs();
});
</script>

</body>
</html>`);
});

server.listen(3005, () => {
    console.log('UI: http://localhost:3005');
});
