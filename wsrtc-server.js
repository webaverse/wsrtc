const ws = require('ws');
const Y = require('yjs');

const jsonParse = s => {
  try {
    return JSON.parse(s);
  } catch (err) {
    return null;
  }
};

class User {
  constructor(id, ws) {
    this.id = id;
    this.ws = ws;
    this.lastMessage = null;
  }
  toJSON() {
    const {id} = this;
    return {
      id,
    };
  }
}
class Room {
  constructor(url) {
    this.url = url;
    this.users = [];
    this.state = new Y.Doc();
  }
}

const wss = new ws.WebSocketServer({
  noServer: true,
});
const rooms = new Map();
wss.on('connection', (ws, req) => {
  let room = rooms.get(req.url);
  if (!room) {
    room = new Room(req.url);
    rooms.set(req.url, room);
  }
  const id = Math.floor(Math.random() * 0xFFFFFF);
  const localUser = new User(id, ws);
  room.users.push(localUser);
  ws.addEventListener('close', () => {
    for (const user of room.users) {
      if (user !== localUser) {
        user.ws.send(JSON.stringify({
          method: 'leave',
          id,
        }));
      }
    }
    
    room.users.splice(room.users.indexOf(localUser), 1);
  });
  
  // send init
  ws.send(JSON.stringify({
    method: 'init',
    args: {
      id,
      users: room.users,
    },
  }));
  
  // send initial state
  {
    const updateBuffer = Y.encodeStateAsUpdate(room.state);
    const b = Buffer.alloc(Uint32Array.BYTES_PER_ELEMENT + updateBuffer.byteLength);
    new Uint32Array(b.buffer, b.byteOffset, 1)[0] = 0;
    b.set(updateBuffer, Uint32Array.BYTES_PER_ELEMENT);
    
    ws.send(JSON.stringify({
      method: 'stateupdate',
      id: 0,
    }));
    ws.send(b);
  }

  // notify users about the join
  for (const user of room.users) {
    if (user !== localUser) {
      user.ws.send(JSON.stringify({
        method: 'join',
        id,
      }));
    }
  }
  
  ws.addEventListener('message', e => {
    for (const user of room.users) {
      if (user !== localUser) {
        user.ws.send(e.data);
      }
    }
    
    if (typeof e.data === 'string') {
      const j = jsonParse(e.data);
      if (j) {
        const {method} = j;
        switch (method) {
          case 'stateupdate': {
            localUser.lastMessage = j;
            break;
          }
        }
      } else {
        localUser.lastMessage = null;
      }
    } else {
      if (localUser.lastMessage && localUser.lastMessage.method === 'stateupdate') {
        Y.applyUpdate(room.state, e.data);
        localUser.lastMessage = null;
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