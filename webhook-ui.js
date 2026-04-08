const http = require('http');

let logs = [];
let totalReceived = 0; // Track total webhooks received (all time)

const server = http.createServer((req, res) => {
    // CLEAR LOGS
    if (req.url === '/clear' && req.method === 'POST') {
        logs = [];
        totalReceived = 0; // Reset total counter when clearing
        res.writeHead(200);
        res.end('cleared');
        return;
    }

    // LOGS ENDPOINT
    if (req.url === '/logs') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ logs, totalReceived }));
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

            // Increment total counter
            totalReceived++;

            // Add new webhook to the beginning
            logs.unshift({
                id: Date.now() + Math.random(),
                time: new Date().toISOString(),
                url: req.url,
                method: req.method,
                headers: req.headers,
                body: parsed,
                sequence: totalReceived // Add sequence number
            });

            // Keep only the most recent 50 webhooks in memory
            if (logs.length > 50) {
                logs = logs.slice(0, 50);
            }

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
        * {
            box-sizing: border-box;
        }

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
            align-items: center;
            flex-wrap: wrap;
        }

        button {
            background: transparent;
            color: #00ff9c;
            border: 1px solid #00ff9c;
            padding: 6px 12px;
            cursor: pointer;
            font-family: monospace;
            transition: all 0.2s;
        }

        button:hover {
            background: #00ff9c;
            color: #000;
        }

        .stats {
            display: flex;
            gap: 10px;
            margin-left: auto;
        }

        .stat-box {
            background: #00ff9c20;
            padding: 6px 12px;
            border: 1px solid #00ff9c;
            font-weight: bold;
        }

        .logs {
            padding: 10px;
        }

        .entry {
            border: 1px solid #00ff9c22;
            margin-bottom: 12px;
            padding: 10px;
            transition: border-color 0.2s;
        }

        .entry:hover {
            border-color: #00ff9c66;
        }

        .meta {
            font-size: 12px;
            margin-bottom: 8px;
            color: #00ffaa;
            word-break: break-all;
            display: flex;
            align-items: center;
            gap: 8px;
            flex-wrap: wrap;
        }

        .meta-text {
            flex: 1;
        }

        .sequence-badge {
            background: #00ff9c30;
            padding: 2px 6px;
            border-radius: 3px;
            font-size: 10px;
            font-weight: bold;
        }

        .actions {
            margin-bottom: 6px;
            display: flex;
            gap: 6px;
            flex-wrap: wrap;
        }

        .icon-btn {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            font-size: 12px;
            padding: 4px 8px;
            border: 1px solid #00ff9c55;
            cursor: pointer;
            background: transparent;
            color: #00ff9c;
            transition: all 0.2s;
        }

        .icon-btn:hover {
            background: #00ff9c;
            color: #000;
        }

        .icon-btn svg {
            width: 14px;
            height: 14px;
            fill: currentColor;
        }

        pre {
            background: #000;
            padding: 10px;
            overflow-x: auto;
            white-space: pre-wrap;
            word-break: break-word;
            border: 1px solid #00ff9c22;
            user-select: text;
            margin: 0;
        }

        .empty {
            opacity: 0.5;
            text-align: center;
            padding: 40px;
        }

        a {
            color: #00ff9c;
            text-decoration: underline;
        }

        .toast {
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: #00ff9c;
            color: #000;
            padding: 8px 16px;
            border-radius: 4px;
            font-size: 12px;
            opacity: 0;
            transition: opacity 0.3s;
            pointer-events: none;
        }

        .toast.show {
            opacity: 1;
        }

        @media (max-width: 768px) {
            .topbar {
                flex-direction: column;
                align-items: stretch;
            }
            
            .stats {
                margin-left: 0;
                justify-content: space-between;
            }
        }
    </style>
</head>
<body>

<div class="topbar">
    <button onclick="refreshLogs()">🔄 Refresh (r)</button>
    <button onclick="clearLogs()">🗑️ Clear (c)</button>
    <div class="stats">
        <div class="stat-box" id="displayedCount">Displayed: 0</div>
        <div class="stat-box" id="totalCount">Total Received: 0</div>
    </div>
</div>

<div class="logs" id="logs"></div>
<div class="toast" id="toast">Copied!</div>

<script>
let logsData = [];
let totalReceived = 0;

function showToast(message) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => {
        toast.classList.remove('show');
    }, 1500);
}

function format(obj) {
    try {
        return JSON.stringify(obj, null, 2);
    } catch {
        return String(obj);
    }
}

async function copy(text, type) {
    try {
        await navigator.clipboard.writeText(text);
        showToast(\`\${type} copied!\`);
    } catch (err) {
        showToast('Failed to copy');
    }
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

function render(logs, total) {
    const container = document.getElementById('logs');
    container.innerHTML = '';

    // Update counters
    const displayedCountEl = document.getElementById('displayedCount');
    const totalCountEl = document.getElementById('totalCount');
    
    displayedCountEl.textContent = \`Displayed: \${logs.length}\`;
    displayedCountEl.title = \`Currently showing \${logs.length} most recent webhooks\`;
    
    totalCountEl.textContent = \`Total Received: \${total}\`;
    totalCountEl.title = \`Total webhooks received since last clear\`;

    if (!logs.length) {
        container.innerHTML = '<div class="empty">📭 No webhooks received yet</div>';
        return;
    }

    logs.forEach((log, index) => {
        const div = document.createElement('div');
        div.className = 'entry';

        const bodyText = format(log.body);
        const headersText = format(log.headers);
        const fullWebhookText = \`#\${log.sequence} | \${log.time} | \${log.method} | \${log.url}\\n\\nHeaders:\\n\${headersText}\\n\\nBody:\\n\${bodyText}\`;

        const safeBody = linkify(escapeHtml(bodyText));
        const safeUrl = linkify(escapeHtml(log.url));

        div.innerHTML = \`
            <div class="meta">
                <span class="sequence-badge">#\${log.sequence}</span>
                <span class="meta-text">
                    📅 \${log.time} | 📍 \${log.method} | 🔗 \${safeUrl}
                </span>
            </div>

            <div class="actions">
                <button class="icon-btn copy-body" title="Copy body">
                    <svg viewBox="0 0 24 24" width="14" height="14">
                        <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
                    </svg>
                    Copy Body
                </button>
                <button class="icon-btn copy-headers" title="Copy headers">
                    <svg viewBox="0 0 24 24" width="14" height="14">
                        <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
                    </svg>
                    Copy Headers
                </button>
                <button class="icon-btn copy-full" title="Copy entire webhook">
                    <svg viewBox="0 0 24 24" width="14" height="14">
                        <path d="M19 3h-4.18C14.4 1.84 13.3 1 12 1c-1.3 0-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm2 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/>
                    </svg>
                    Copy All
                </button>
            </div>

            <pre>\${safeBody}</pre>
        \`;

        const copyBodyBtn = div.querySelector('.copy-body');
        const copyHeadersBtn = div.querySelector('.copy-headers');
        const copyFullBtn = div.querySelector('.copy-full');

        copyBodyBtn.onclick = () => copy(bodyText, 'Body');
        copyHeadersBtn.onclick = () => copy(headersText, 'Headers');
        copyFullBtn.onclick = () => copy(fullWebhookText, 'Full webhook');

        container.appendChild(div);
    });
}

async function refreshLogs() {
    try {
        const res = await fetch('/logs');
        const data = await res.json();
        logsData = data.logs;
        totalReceived = data.totalReceived;
        render(logsData, totalReceived);
    } catch (e) {
        console.error('Failed to refresh logs:', e);
    }
}

async function clearLogs() {
    await fetch('/clear', { method: 'POST' });
    refreshLogs();
    showToast('All logs cleared');
}

// Auto-refresh every 2 seconds
let refreshInterval = setInterval(refreshLogs, 2000);
refreshLogs();

document.addEventListener('keydown', (e) => {
    if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        refreshLogs();
        showToast('Refreshed');
    }
    if (e.key === 'c' || e.key === 'C') {
        e.preventDefault();
        clearLogs();
    }
});

// Cleanup interval on page unload
window.addEventListener('beforeunload', () => {
    if (refreshInterval) clearInterval(refreshInterval);
});
</script>

</body>
</html>`);
});

const PORT = 3005;
server.listen(PORT, () => {
    console.log(`🚀 Webhook Inspector running at: http://localhost:${PORT}`);
    console.log(`📡 Ready to receive webhooks on any POST endpoint`);
});