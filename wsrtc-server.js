const url = require('url');
const ws = require('ws');
const Y = require('yjs');
const {encodeMessage, loadState} = require('./ws-util-server.js');
const {MESSAGE} = require('./ws-constants-server.js');

const appsMapName = 'apps';
const playersMapName = 'players';

const sendMessage = (ws, parts) => {
  let encodedMessage = encodeMessage(parts);
  encodedMessage = encodedMessage.slice(); // deduplicate
  ws.send(encodedMessage);
};

class Player {
  constructor(playerId, ws) {
    this.playerId = playerId;
    this.ws = ws;
  }
}
class Room {
  constructor(name, initialState) {
    this.name = name;
    this.players = [];
    this.state = new Y.Doc();
    
    if (initialState) {
      for (const k in initialState) {
        const v = initialState[k];
        if (Array.isArray(v)) {
          const array = this.state.getArray(k);
          for (const e of v) {
            const map = new Y.Map();
            for (const k2 in e) {
              map.set(k2, e[k2]);
            }
            array.push([map]);
          }
        } else if (typeof v === 'object') {
          const map = this.state.getMap(k);
          for (const k2 in v) {
            const v2 = v[k2];
            map.set(k2, v2);
          }
        }
      }
    }
  }
  getPlayersState() {
    return this.state.getArray(playersMapName);
  }
  getPlayersArray() {
    return Array.from(this.getPlayersState());
  }
  removePlayer(playerId) {
    this.state.transact(() => {
      const playersArray = this.getPlayersArray();
      const index = playersArray.indexOf(playerId);
      
      const player = this.state.getMap(playersMapName + '.' + playerId);
      const keys = Array.from(player.keys());
      for (const key of keys) {
        player.delete(key);
      }
      
      const players = this.getPlayersState();
      players.delete(index, 1);
    });
  }
  save() {
    // console.log('save room', this.name);
  }
}

const bindServer = (server, {initialRoomState = null, initialRoomNames = []} = []) => {
  const wss = new ws.WebSocketServer({
    noServer: true,
  });
  const rooms = new Map();
  const _getOrCreateRoom = roomId => {
    let room = rooms.get(roomId);
    if (!room) {
      room = new Room(roomId, initialRoomState);
      rooms.set(roomId, room);
    }
    return room;
  };
  const _roomToJson = room => {
    let {name, /*players, */state} = room;
    /* players = players.map(player => {
      const {id} = player;
      return {
        id,
      };
    }); */
    state = state.toJSON();
    return {
      name,
      // players,
      state,
    };
  };
  wss.on('connection', (ws, req) => {
    const o = url.parse(req.url, true);
    const match = o.pathname.match(/^\/([a-z0-9\-_]+)$/i);
    const roomId = match && match[1];
    const {playerId} = o.query;
    if (roomId && playerId) {
      const room = _getOrCreateRoom(roomId);
      
      console.log('got connection', o.query, o.queryString);
      
      // const id = Math.floor(Math.random() * 0xFFFFFF);
      const localPlayer = new Player(playerId, ws);
      room.players.push(localPlayer);

      ws.addEventListener('close', () => {
        room.removePlayer(playerId);
      });
      
      // send init
      const encodedStateData = Y.encodeStateAsUpdate(room.state);
      console.log('encoded state data', encodedStateData.constructor, encodedStateData.byteLength);
      sendMessage(ws, [
        MESSAGE.INIT,
        encodedStateData,
      ]);

      /* // notify users about the join
      for (const user of room.users) {
        if (user !== localUser) {
          sendMessage(user.ws, [
            MESSAGE.JOIN,
            id,
          ]);
        }
      } */
      
      ws.addEventListener('message', e => {
        for (const player of room.players) {
          if (player !== localPlayer) {
            player.ws.send(e.data);
          }
        }
        
        const dataView = new DataView(e.data.buffer, e.data.byteOffset);
        const method = dataView.getUint32(0, true);
        switch (method) {
          case MESSAGE.STATE_UPDATE: {
            const byteLength = dataView.getUint32(Uint32Array.BYTES_PER_ELEMENT, true);
            const data = new Uint8Array(e.data.buffer, e.data.byteOffset + 2 * Uint32Array.BYTES_PER_ELEMENT, byteLength);
            Y.applyUpdate(room.state, data);
            // room.save();
            break;
          }
        }
      });
    } else {
      console.warn('ws url did not match', o);
      ws.close();
    }
  });

  server.on('request', (req, res) => {
    console.log('got req', req.method, req.url);
    
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', '*');
    res.setHeader('Access-Control-Allow-Headers', '*');
    
    if (req.method === 'HEAD' || req.method === 'OPTIONS') {
      res.end();
    } else {
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
          if (roomName) {
            const bs = [];
            req.on('data', d => {
              bs.push(d);
            });
            req.on('end', () => {
              const b = Buffer.concat(bs);
              bs.length = 0;
              
              const data = Uint8Array.from(b);
              const room = _getOrCreateRoom(roomName);
              room.state.transact(() => {
                Y.applyUpdate(room.state, data);
                loadState(room.state);
              });
              console.log('set room state', room.state.toJSON());
              
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ok: true}));
            });
          } else {
            res.status = 404;
            res.end('not found');
          }
        } else if (req.method === 'DELETE') {
          const room = rooms.get(roomName);
          if (room) {
            for (const player of room.players) {
              player.ws.terminate();
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
    }
  });
  server.on('upgrade', (req, socket, head) => {
    wss.handleUpgrade(req, socket, head, ws => {
      wss.emit('connection', ws, req);
    });
  });
  
  for (const name of initialRoomNames) {
    _getOrCreateRoom(name);
  }
};

module.exports = {
  bindServer,
};