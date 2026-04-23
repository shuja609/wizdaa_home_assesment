const express = require('express');
const app = express();
app.use(express.json());

let balances = {};
let config = { unreliable: false };

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const randomDelay = () => {
  const ms = Math.floor(Math.random() * 150) + 50; // 50-200ms
  return delay(ms);
};

// Seed initial state
app.post('/hcm/_reset', (req, res) => {
  balances = {};
  config.unreliable = false;
  res.sendStatus(200);
});

app.post('/hcm/_config', (req, res) => {
  if (req.body.unreliable !== undefined) {
    config.unreliable = req.body.unreliable;
  }
  res.sendStatus(200);
});

app.get('/hcm/balance/:employeeId/:locationId/:leaveType', async (req, res) => {
  await randomDelay();
  const { employeeId, locationId, leaveType } = req.params;
  const key = `${employeeId}:${locationId}:${leaveType}`;
  
  if (!balances[key]) {
    // Auto-seed for convenience
    balances[key] = { balance: 10, hcmVersion: 'v1' };
  }

  res.json({
    employeeId,
    locationId,
    leaveType,
    balance: balances[key].balance,
    hcmVersion: balances[key].hcmVersion,
  });
});

app.post('/hcm/balance/debit', async (req, res) => {
  await randomDelay();
  const { employeeId, locationId, leaveType, days } = req.body;
  const key = `${employeeId}:${locationId}:${leaveType}`;

  if (config.unreliable) {
    // Unreliable mode: sometimes silently "succeeds" without touching balances, 
    // or just returns 200 immediately
    if (Math.random() > 0.5) {
      return res.json({ success: true, newBalance: balances[key]?.balance || 0 }); // Liar!
    }
  }

  if (!balances[key]) {
    return res.status(404).json({ success: false, error: 'Employee balance not found' });
  }

  if (balances[key].balance < days) {
    return res.status(422).json({ success: false, error: 'Insufficient HCM balance' });
  }

  balances[key].balance -= days;
  balances[key].hcmVersion = `v${Date.now()}`;

  res.json({ success: true, newBalance: balances[key].balance });
});

app.post('/hcm/balance/credit', async (req, res) => {
  await randomDelay();
  const { employeeId, locationId, leaveType, days } = req.body;
  const key = `${employeeId}:${locationId}:${leaveType}`;

  if (!balances[key]) balances[key] = { balance: 0, hcmVersion: 'v1' };

  balances[key].balance += days;
  balances[key].hcmVersion = `v${Date.now()}`;

  res.json({ success: true, newBalance: balances[key].balance });
});

const PORT = process.env.MOCK_HCM_PORT || 3001;
let server;
if (require.main === module) {
  server = app.listen(PORT, () => {
    console.log(`Mock HCM Server running on port ${PORT}`);
  });
} else {
  // Export app for test binding
  module.exports = app;
}

