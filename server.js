const express = require('express');
const cors = require('cors');
const { Client, LocalAuth } = require('whatsapp-web.js');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

let client = null;
let isReady = false;
let incomingMessages = [];
let sentMessages = [];

function initWhatsApp() {
  if (client) return;
  
  console.log('🔄 Initializing WhatsApp...');
  
  client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    }
  });
  
  client.on('qr', (qr) => {
    console.log('\n' + '='.repeat(60));
    console.log('📱 SCAN THIS QR CODE WITH YOUR WHATSAPP');
    console.log('📱 Open WhatsApp → Linked Devices → Link a Device');
    console.log('='.repeat(60));
    console.log(qr);
    console.log('='.repeat(60) + '\n');
  });
  
  client.on('ready', () => {
    isReady = true;
    console.log('\n' + '='.repeat(60));
    console.log('✅ WHATSAPP IS READY!');
    console.log('='.repeat(60) + '\n');
  });
  
  client.on('message', async (msg) => {
    if (!msg.body) return;
    incomingMessages.push({
      from: msg.from.replace('@c.us', ''),
      body: msg.body,
      time: new Date().toLocaleTimeString(),
      timestamp: Date.now()
    });
    if (incomingMessages.length > 100) incomingMessages.shift();
  });
  
  client.initialize();
}

app.get('/', (req, res) => {
  res.send(`<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=240, initial-scale=1.0">
<meta http-equiv="refresh" content="15">
<title>💬 WhatsApp</title>
<style>
* { margin:0; padding:0; box-sizing:border-box; }
body { background:#0a0a0a; color:#fff; font-family:Arial; padding:8px; max-width:240px; margin:0 auto; }
.header { background:#075E54; padding:10px; text-align:center; border-radius:8px 8px 0 0; }
.header h1 { font-size:18px; }
.header .status { font-size:10px; color:#aaa; }
.status-dot { display:inline-block; width:8px; height:8px; border-radius:50%; margin-right:4px; }
.online { background:#25D366; }
.connecting { background:#ffaa00; animation: blink 1s infinite; }
@keyframes blink { 0%,100%{opacity:1;} 50%{opacity:0;} }
.messages { margin:8px 0; max-height:400px; overflow-y:auto; }
.msg { padding:8px 10px; margin:4px 0; border-radius:8px; word-wrap:break-word; }
.msg-incoming { background:#075E54; border-left:3px solid #25D366; }
.msg-outgoing { background:#1a1a1a; border-left:3px solid #ffaa00; }
.msg .from { color:#aaa; font-size:9px; margin-bottom:2px; }
.msg .body { font-size:14px; }
.msg .time { color:#666; font-size:8px; text-align:right; margin-top:2px; }
input, button { width:100%; padding:10px; margin:3px 0; font-size:14px; border:none; border-radius:6px; }
input { background:#222; color:#fff; border:1px solid #333; }
button { background:#25D366; color:#000; font-weight:bold; cursor:pointer; }
.btn-secondary { background:#333; color:#fff; font-size:12px; }
.settings { background:#111; padding:8px; margin:8px 0; border-radius:6px; border:1px solid #222; }
.settings label { font-size:9px; color:#888; display:block; }
.settings input { font-size:12px; padding:6px; }
.notification { padding:6px; text-align:center; font-size:11px; font-weight:bold; border-radius:4px; margin:4px 0; }
.footer { text-align:center; margin-top:8px; font-size:8px; color:#444; }
</style>
</head>
<body>
<div class="header">
<h1>💬 WhatsApp</h1>
<div class="status">
<span class="status-dot ${isReady ? 'online' : 'connecting'}"></span>
${isReady ? '✅ Connected' : '⏳ Connecting...'}
</div>
</div>
<div class="settings">
<label>📱 Your Number (with country code):</label>
<input type="text" id="myNumber" placeholder="e.g., 919876543210" value="" onchange="saveNumber()" autocomplete="off">
</div>
<div id="messages" class="messages">
<div style="color:#666;text-align:center;padding:20px;font-size:12px;">📭 No messages yet</div>
</div>
<div style="background:#111;padding:8px;border-radius:0 0 8px 8px;">
<input type="text" id="targetNumber" placeholder="Target: 919876543210" style="font-size:12px;">
<input type="text" id="messageInput" placeholder="Type message..." onkeypress="if(event.keyCode==13) sendMessage();">
<button onclick="sendMessage()">📤 SEND</button>
<button onclick="refreshMessages()" class="btn-secondary">🔄 Refresh</button>
</div>
<div id="notification"></div>
<div class="footer">Last updated: <span id="timestamp">-</span></div>
<script>
let myNumber = '';

function saveNumber() {
  const phone = document.getElementById('myNumber').value.trim();
  if (phone) {
    localStorage.setItem('whatsappNumber', phone);
    myNumber = phone;
    showNotification('✅ Number saved!', '#25D366');
  }
}

window.onload = function() {
  const saved = localStorage.getItem('whatsappNumber');
  if (saved) {
    document.getElementById('myNumber').value = saved;
    myNumber = saved;
  }
};

function refreshMessages() {
  const phone = document.getElementById('myNumber').value.trim();
  if (phone) {
    myNumber = phone;
    localStorage.setItem('whatsappNumber', phone);
  }
  
  fetch('/messages')
    .then(r => r.json())
    .then(data => {
      const container = document.getElementById('messages');
      const msgs = data.messages || [];
      if (msgs.length === 0) {
        container.innerHTML = '<div style="color:#666;text-align:center;padding:20px;font-size:12px;">📭 No messages</div>';
        return;
      }
      let html = '';
      const start = Math.max(0, msgs.length - 20);
      for (let i = msgs.length - 1; i >= start; i--) {
        const msg = msgs[i];
        const isIncoming = msg.from !== myNumber && msg.from !== 'me';
        const bgClass = isIncoming ? 'msg-incoming' : 'msg-outgoing';
        const from = isIncoming ? '📩 ' + msg.from : '📤 Me';
        html += '<div class="msg ' + bgClass + '">';
        html += '<div class="from">' + from + '</div>';
        html += '<div class="body">' + msg.body + '</div>';
        html += '<div class="time">' + (msg.time || '') + '</div>';
        html += '</div>';
      }
      container.innerHTML = html;
      document.getElementById('timestamp').textContent = new Date().toLocaleTimeString();
    })
    .catch(() => {});
}

function sendMessage() {
  const to = document.getElementById('targetNumber').value.trim().replace(/[^0-9]/g, '');
  const message = document.getElementById('messageInput').value.trim();
  const from = document.getElementById('myNumber').value.trim();
  
  if (!from) { alert('Set your number first!'); return; }
  if (!to) { alert('Enter target number!'); return; }
  if (!message) { alert('Enter a message!'); return; }
  
  showNotification('⏳ Sending...', '#ffaa00');
  
  fetch('/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to, message })
  })
  .then(r => r.json())
  .then(data => {
    if (data.success) {
      document.getElementById('messageInput').value = '';
      showNotification('✅ Sent!', '#25D366');
      refreshMessages();
    } else {
      showNotification('❌ ' + (data.error || 'Failed'), '#ff4444');
    }
  })
  .catch(() => {
    showNotification('❌ Network error', '#ff4444');
  });
}

function showNotification(text, color) {
  const div = document.getElementById('notification');
  div.innerHTML = '<div style="background:' + color + ';color:#000;padding:6px;text-align:center;font-weight:bold;border-radius:4px;">' + text + '</div>';
  setTimeout(() => div.innerHTML = '', 3000);
}

refreshMessages();
setInterval(refreshMessages, 10000);
</script>
</body>
</html>`);
});

app.get('/messages', (req, res) => {
  const allMessages = [...incomingMessages, ...sentMessages];
  allMessages.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
  res.json({ messages: allMessages.slice(-50), ready: isReady });
});

app.post('/send', async (req, res) => {
  const { from, to, message } = req.body;
  if (!to || !message) {
    return res.status(400).json({ success: false, error: 'Missing fields' });
  }
  if (!isReady) {
    return res.status(503).json({ success: false, error: 'WhatsApp not ready. Scan QR code first.' });
  }
  try {
    const cleanTo = to.replace(/[^0-9]/g, '');
    await client.sendMessage(cleanTo + '@c.us', message);
    sentMessages.push({
      to: cleanTo,
      message: message,
      time: new Date().toLocaleTimeString(),
      timestamp: Date.now()
    });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

initWhatsApp();

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('\n' + '='.repeat(60));
  console.log('💬 WHATSAPP PROXY RUNNING');
  console.log('='.repeat(60));
  console.log('✅ Server started successfully');
  console.log('\n📱 ON YOUR NOKIA 2660:');
  console.log('   Use your Railway URL + /api/wap');
  console.log('='.repeat(60) + '\n');
});