const ws = require('ws');
const Y = require('yjs');
const {encodeMessage} = require('./ws-util-server.js');
const {MESSAGE} = require('./ws-constants-server.js');

const jsonParse = s => {
  try {
    return JSON.parse(s);
  } catch (err) {
    return null;
  }
};
const sendMessage = (ws, parts) => {
  let encodedMessage = encodeMessage(parts);
  encodedMessage = encodedMessage.slice(); // deduplicate
  ws.send(encodedMessage);
};

class User {
  constructor(id, ws) {
    this.id = id;
    this.ws = ws;
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
        sendMessage(user.ws, [
          MESSAGE.LEAVE,
          id,
        ]);
      }
    }
    
    room.users.splice(room.users.indexOf(localUser), 1);
  });
  
  // send init
  {
    const usersData = new Uint32Array(room.users.length);
    for (let i = 0; i < room.users.length; i++) {
      usersData[i] = room.users[i].id;
    }
    // console.log('got user data', usersData);
    const roomStateData = Y.encodeStateAsUpdate(room.state);
    sendMessage(ws, [
      MESSAGE.INIT,
      id,
      usersData,
      roomStateData,
    ]);
  }

  // notify users about the join
  for (const user of room.users) {
    if (user !== localUser) {
      sendMessage(user.ws, [
        MESSAGE.JOIN,
        id,
      ]);
    }
  }
  
  ws.addEventListener('message', e => {
    for (const user of room.users) {
      if (user !== localUser) {
        user.ws.send(e.data);
      }
    }
    
    const dataView = new DataView(e.data.buffer, e.data.byteOffset);
    const method = dataView.getUint32(0, true);
    switch (method) {
      case MESSAGE.ROOMSTATE: {
        const byteLength = dataView.getUint32(Uint32Array.BYTES_PER_ELEMENT, true);
        const data = new Uint8Array(e.data.buffer, e.data.byteOffset + 2 * Uint32Array.BYTES_PER_ELEMENT, byteLength);
        Y.applyUpdate(room.state, data);
        break;
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