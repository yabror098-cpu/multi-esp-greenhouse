const express = require('express');
const http = require('http');
const path = require('path');

const PORT = process.env.PORT || 3000;
const app = express();
const server = http.createServer(app);

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ===================== HOLAT =====================
let sensorData = {
  a: { temps: [25.8, 25.7, 24.8, 27.0], relays: [false, false, false, false] },
  b: { temps: [25.2, 24.6, 26.4, 23.9], relays: [false, false, false, false] }
};

// ===================== API =====================
app.post('/api/data', (req, res) => {
  const d = req.body;
  const sektor = d.device_id === 1 ? 'a' : 'b';
  
  sensorData[sektor].temps = d.temps || sensorData[sektor].temps;
  sensorData[sektor].relays = d.relays || sensorData[sektor].relays;

  console.log(`\n[${new Date().toLocaleTimeString()}] ESP #${d.device_id}:`);
  console.log(`  Temps: ${d.temps.join(', ')}°C`);
  console.log(`  Relays: ${d.relays.map(r => r?'ON':'OFF').join(', ')}`);

  res.json({ status: 'ok', relays: sensorData[sektor].relays });
});

app.get('/api/status', (req, res) => {
  res.json(sensorData);
});

// ===================== SERVER =====================
server.listen(PORT, () => {
  console.log('================================');
  console.log(` Multi-ESP Greenhouse Backend`);
  console.log(` Dashboard: http://localhost:${PORT}`);
  console.log(` Port: ${PORT}`);
  console.log('================================');
});
