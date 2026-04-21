const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data', 'events.json');

// Ensure data directory exists
fs.mkdirSync(path.join(__dirname, 'data'), { recursive: true });

function loadEvents() {
  try {
    const data = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(data);
  } catch (e) {
    return [];
  }
}

function saveEvents(events) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(events, null, 2));
}

// Map event to ledger entries (same as before)
function mapToLedger(event) {
  const ledgerEntries = [];
  const amount = event.kgTotales || 0;
  switch (event.tipo) {
    case 'VENTA':
      ledgerEntries.push({ fecha: event.fecha, cuenta: 'Clientes', tipo: 'DEBE', importe: amount });
      ledgerEntries.push({ fecha: event.fecha, cuenta: 'Ganado en pie', tipo: 'HABER', importe: amount });
      break;
    case 'COMPRA':
      ledgerEntries.push({ fecha: event.fecha, cuenta: 'Ganado en pie', tipo: 'DEBE', importe: amount });
      ledgerEntries.push({ fecha: event.fecha, cuenta: 'Proveedores', tipo: 'HABER', importe: amount });
      break;
    case 'CAMBIO_CATEGORIA':
      ledgerEntries.push({ fecha: event.fecha, cuenta: 'Ganado en pie', tipo: 'DEBE', importe: amount });
      ledgerEntries.push({ fecha: event.fecha, cuenta: 'Resultado por revalorización', tipo: 'HABER', importe: amount });
      break;
    default:
      break;
  }
  return ledgerEntries;
}

function getBalance(ledger) {
  const balance = {};
  ledger.forEach(entry => {
    if (!balance[entry.cuenta]) {
      balance[entry.cuenta] = { debe: 0, haber: 0 };
    }
    if (entry.tipo === 'DEBE') {
      balance[entry.cuenta].debe += entry.importe;
    } else {
      balance[entry.cuenta].haber += entry.importe;
    }
  });
  return balance;
}

function serveStaticFile(res, filepath) {
  fs.readFile(filepath, (err, data) => {
    if (err) {
      res.statusCode = 404;
      res.end('Not found');
      return;
    }
    // Determine content type
    let ext = path.extname(filepath).toLowerCase();
    let contentType = 'text/html';
    if (ext === '.js') contentType = 'application/javascript';
    else if (ext === '.css') contentType = 'text/css';
    else if (ext === '.json') contentType = 'application/json';
    res.setHeader('Content-Type', contentType);
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  if (req.method === 'GET' && parsedUrl.pathname === '/events') {
    const events = loadEvents();
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(events));
    return;
  }
  if (req.method === 'POST' && parsedUrl.pathname === '/events') {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
    });
    req.on('end', () => {
      try {
        const event = JSON.parse(body);
        const events = loadEvents();
        event.id = crypto.randomUUID();
        events.push(event);
        saveEvents(events);
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ status: 'ok', id: event.id }));
      } catch (err) {
        res.statusCode = 400;
        res.end(JSON.stringify({ status: 'error', message: 'Invalid JSON' }));
      }
    });
    return;
  }
  if (req.method === 'GET' && parsedUrl.pathname === '/ledger') {
    const events = loadEvents();
    let ledger = [];
    events.forEach(evt => {
      ledger = ledger.concat(mapToLedger(evt));
    });
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(ledger));
    return;
  }
  if (req.method === 'GET' && parsedUrl.pathname === '/balance') {
    const events = loadEvents();
    const ledger = [];
    events.forEach(evt => {
      ledger.push(...mapToLedger(evt));
    });
    const balance = getBalance(ledger);
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(balance));
    return;
  }
  // Serve static files from public directory
  let filePath = path.join(__dirname, 'public', parsedUrl.pathname);
  if (parsedUrl.pathname === '/' || parsedUrl.pathname === '') {
    filePath = path.join(__dirname, 'public', 'index.html');
  }
  serveStaticFile(res, filePath);
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
