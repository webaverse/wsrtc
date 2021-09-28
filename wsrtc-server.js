const url = require('url');
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
const _getOrCreateRoom = roomName => {
  let room = rooms.get(roomName);
  if (!room) {
    room = new Room(roomName);
    rooms.set(roomName, room);
  }
  return room;
};
_getOrCreateRoom('Erithor');
const _roomToJson = room => {
  let {url, users, state} = room;
  users = users.map(user => {
    const {id} = user;
    return {
      id,
    };
  });
  return {
    url,
    users,
    state,
  };
};
wss.on('connection', (ws, req) => {
  const o = url.parse(req.url, true);
  const match = o.pathname.match(/^\/([a-z0-9\-_]+)$/i);
  if (match) {
    const roomName = match[1];
    const room = _getOrCreateRoom(roomName);
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
          room.save();
          break;
        }
      }
    });
  } else {
    console.warn('ws url did not match', o);
    ws.close();
  }
});
const bindServer = server => {
  server.on('request', (req, res) => {
    const o = url.parse(req.url, true);
    // console.log('server request', o);
    const match = o.pathname.match(/^\/@worlds\/([\s\S]*)?$/);
    if (match) {
      const roomName = match[1];
      if (req.method === 'GET') {
        if (!roomName) {
          const j = Array.from(rooms.values()).map(_roomToJson);
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(j));
        } else {
          const room = rooms.get(roomName);
          if (room) {
            const j = _roomToJson(room);
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(j));
          } else {
            res.status = 404;
            res.end('not found');
          }
        }
      } else if (req.method === 'POST') {
        const room = _getOrCreateRoom(roomName);
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ok: true}));
      } else if (req.method === 'DELETE') {
        const room = rooms.get(roomName);
        if (room) {
          for (const user of room.users) {
            user.ws.terminate();
          }
          rooms.delete(roomName);
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ok: true}));
        } else {
          res.status = 404;
          res.end('not found');
        }
      }
    } else {
      res.statusCode = 404;
      res.end('not found');
    }
  });
  server.on('upgrade', (req, socket, head) => {
    wss.handleUpgrade(req, socket, head, ws => {
      wss.emit('connection', ws, req);
    });
  });
};

module.exports = {
  bindServer,
};