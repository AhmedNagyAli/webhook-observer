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
    res.end(`
<!DOCTYPE html>
<html>
<head>
    <title>Webhook Inspector</title>
    <style>
        body { font-family: monospace; background:#111; color:#0f0; padding:20px; }
        pre { background:#000; padding:10px; overflow:auto; }
        .entry { margin-bottom:20px; border-bottom:1px solid #333; }
        button { background:#900; color:#fff; border:none; padding:10px; cursor:pointer; }
    </style>
</head>
<body>
    <h2>Webhook Logs</h2>

    <button onclick="clearLogs()">CLEAR</button>

    <div id="logs"></div>

    <script>
        async function load() {
            const res = await fetch('/logs');
            const data = await res.json();

            const container = document.getElementById('logs');
            container.innerHTML = '';

            data.forEach(log => {
                const div = document.createElement('div');
                div.className = 'entry';

                div.innerHTML = \`
                    <div><b>\${log.time}</b> [\${log.method}] \${log.url}</div>
                    <pre>\${JSON.stringify(log.body, null, 2)}</pre>
                \`;

                container.appendChild(div);
            });
        }

        async function clearLogs() {
            await fetch('/clear', { method: 'POST' });
            load();
        }

        setInterval(load, 1000);
        load();
    </script>
</body>
</html>
    `);
});

server.listen(3005, () => {
    console.log('UI: http://localhost:3005');
});
