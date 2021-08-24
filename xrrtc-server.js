const ws = require('ws');

const wss = new ws.WebSocketServer({
  noServer: true,
});
const users = [];
wss.on('connection', (ws, req) => {
  const id = Math.floor(Math.random() * 0xFFFFFF);
  const localUser = {
    id,
    ws,
  };
  users.push(localUser);
  ws.addEventListener('close', () => {
    for (const user of users) {
      if (user !== localUser) {
        user.ws.send(JSON.stringify({
          method: 'leave',
          id,
        }));
      }
    }
    
    users.splice(users.indexOf(localUser), 1);
  });
  ws.send(JSON.stringify({
    method: 'init',
    args: {
      id,
      users: users.map(u => u.id),
    },
  }));
  for (const user of users) {
    if (user !== localUser) {
      user.ws.send(JSON.stringify({
        method: 'join',
        id,
      }));
    }
  }
  
  // console.log('got ws', req.url);
  ws.addEventListener('message', e => {
    // console.log('got message', e.data);
    for (const user of users) {
      if (user !== localUser) {
        user.ws.send(e.data);
      }
    }
  });
});
const bindServer = server => {
  server.on('upgrade', (req, socket, head) => {
    wss.handleUpgrade(req, socket, head, ws => {
      wss.emit('connection', ws, req);
    });
  });
};

module.exports = {
  bindServer,
};