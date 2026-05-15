const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const PORT = process.env.PORT || 3000;
const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

let sensorData = {
  esp1: { temps:[null,null,null,null], relays:[false,false,false,false], lastSeen:null, autonomous:false },
  esp2: { temps:[null,null,null,null], relays:[false,false,false,false], lastSeen:null, autonomous:false }
};

let schedule = { active:false, interval:null, ventsOn:false, startTime:null };
let scheduleTimer = null;

function broadcast(data) {
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(data));
    }
  });
}

// ESP dan ma'lumot qabul qilish
app.post('/api/data', (req, res) => {
  const d = req.body;
  const key = d.device_id === 1 ? 'esp1' : 'esp2';
  sensorData[key] = {
    temps: d.temps,
    relays: d.relays,
    autonomous: d.autonomous || false,
    lastSeen: new Date().toLocaleTimeString('uz', {
      hour:'2-digit', minute:'2-digit', second:'2-digit'
    })
  };
  console.log(`[ESP#${d.device_id}] T:${d.temps.map(t=>t+'°C').join(' ')} | ${d.autonomous?'AVTONOM':'NORMAL'}`);
  broadcast({ type:'sensorData', data:sensorData });
  res.json({ status:'ok', relays:sensorData[key].relays });
});

// ESP relay holatini so'raganda
app.get('/api/relay-status', (req, res) => {
  const id = parseInt(req.query.id);
  const key = id === 1 ? 'esp1' : 'esp2';
  res.json({ relays: sensorData[key].relays });
});

// Dashboard dan relay boshqaruv
app.post('/api/relay', (req, res) => {
  const { esp, index, state } = req.body;
  const key = esp === 1 ? 'esp1' : 'esp2';
  sensorData[key].relays[index] = state;
  broadcast({ type:'sensorData', data:sensorData });
  console.log(`[Relay] ESP#${esp} Rele${index+1} -> ${state?'ON':'OFF'}`);
  res.json({ status:'ok' });
});

// Jadval boshqaruv
app.post('/api/schedule', (req, res) => {
  const { action, interval } = req.body;
  if (action === 'start') {
    if (scheduleTimer) clearInterval(scheduleTimer);
    schedule = { active:true, interval, ventsOn:true, startTime:Date.now() };
    setAllRelays(true);
    broadcast({ type:'schedule', data:schedule });
    console.log(`[Jadval] ${interval} daqiqa boshlandi`);
    scheduleTimer = setInterval(() => {
      schedule.ventsOn = !schedule.ventsOn;
      schedule.startTime = Date.now();
      setAllRelays(schedule.ventsOn);
      broadcast({ type:'schedule', data:schedule });
      console.log(`[Jadval] ${schedule.ventsOn ? 'YONDI' : "O'CHDI"}`);
    }, interval * 60 * 1000);
  } else if (action === 'stop') {
    if (scheduleTimer) clearInterval(scheduleTimer);
    scheduleTimer = null;
    schedule = { active:false, interval:null, ventsOn:false, startTime:null };
    setAllRelays(false);
    broadcast({ type:'schedule', data:schedule });
    console.log('[Jadval] Toxtatildi');
  }
  res.json({ status:'ok' });
});

// Aloqa holati
app.post('/api/connection', (req, res) => {
  const { device_id, connected } = req.body;
  const key = device_id === 1 ? 'esp1' : 'esp2';
  const sektor = device_id === 1 ? 'A' : 'B';
  if (!connected) sensorData[key].autonomous = true;
  else sensorData[key].autonomous = false;
  broadcast({
    type:'connection', esp:key, connected,
    message: connected
      ? `Sektor ${sektor} aloqa tiklandi`
      : `Sektor ${sektor} aloqa uzildi — avtonom rejimda`
  });
  console.log(`[Aloqa] ESP#${device_id} ${connected?'TIKLANDI':'UZILDI'}`);
  res.json({ status:'ok' });
});

function setAllRelays(state) {
  ['esp1','esp2'].forEach(key => {
    sensorData[key].relays = [state,state,state,state];
  });
  broadcast({ type:'sensorData', data:sensorData });
}

app.get('/api/status', (req, res) => {
  res.json({ sensorData, schedule });
});

wss.on('connection', (ws) => {
  console.log('[WS] Dashboard ulandi');
  ws.send(JSON.stringify({ type:'sensorData', data:sensorData }));
  ws.send(JSON.stringify({ type:'schedule', data:schedule }));
});

server.listen(PORT, () => {
  console.log('=====================================');
  console.log('  Issiqxona server ishga tushdi!');
  console.log(`  Port: ${PORT}`);
  console.log('=====================================');
});
