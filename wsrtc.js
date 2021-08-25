import {channelCount, sampleRate, bitrate, roomEntitiesPrefix, MESSAGE} from './ws-constants.js';
import {WsEncodedAudioChunk, WsMediaStreamAudioReader, WsAudioEncoder, WsAudioDecoder} from './ws-codec.js';
import {ensureAudioContext, getAudioContext} from './ws-audio-context.js';
import {encodeMessage, getEncodedAudioChunkBuffer} from './ws-util.js';
import Y from './y.js';

const textDecoder = new TextDecoder();

class Pose extends EventTarget {
  constructor(position = Float32Array.from([0, 0, 0]), quaternion = Float32Array.from([0, 0, 0, 1]), scale = Float32Array.from([1, 1, 1])) {
    super();
    
    this.position = position;
    this.quaternion = quaternion;
    this.scale = scale;
  }
  set(position, quaternion, scale) {
    this.position.set(position);
    this.quaternion.set(quaternion);
    this.scale.set(scale);
  }
  readUpdate(poseBuffer) {
    const position = new Float32Array(poseBuffer.buffer, poseBuffer.byteOffset, 3);
    this.position.set(position);
    const quaternion = new Float32Array(poseBuffer.buffer, poseBuffer.byteOffset + 3*Float32Array.BYTES_PER_ELEMENT, 4);
    this.quaternion.set(quaternion);
    const scale = new Float32Array(poseBuffer.buffer, poseBuffer.byteOffset + (3+4)*Float32Array.BYTES_PER_ELEMENT, 3);
    this.scale.set(scale);
    
    this.dispatchEvent(new MessageEvent('update'));
  }
}
class Metadata extends EventTarget {
  constructor() {
    super();
    
    this.data = {};
  }
  get(k) {
    return this.data[k];
  }
  set(o) {
    for (const key in o) {
      this.data[key] = o[key];
    }
  }
  readUpdate(o) {
    for (const key in o) {
      this.data[key] = o[key];
    }
    
    const keys = Object.keys(o);
    if (keys.length > 0) {
      this.dispatchEvent(new MessageEvent('update', {
        data: {
          keys,
        },
      }));
    }
  }
  toJSON() {
    return this.data;
  }
}
class Volume extends EventTarget {
  constructor() {
    super();
    
    this.value = 0;
  }
  readUpdate(value) {
    this.value = value;
    
    this.dispatchEvent(new MessageEvent('update', {
      data: {
        value,
      },
    }));
  }
}

class Player extends EventTarget {
  constructor(id) {
    super();
    
    this.id = id;
    this.pose = new Pose(undefined, undefined, undefined);
    this.metadata = new Metadata();
    this.volume = new Volume();
    
    const demuxAndPlay = audioData => {
      let channelData;
      if (audioData.copyTo) { // new api
        channelData = new Float32Array(audioData.numberOfFrames);
        audioData.copyTo(channelData, {
          planeIndex: 0,
          frameCount: audioData.numberOfFrames,
        });
      } else { // old api
        channelData = audioData.buffer.getChannelData(0);
      }
      audioWorkletNode.port.postMessage(channelData, [channelData.buffer]);
    };
    function onDecoderError(err) {
      console.warn('decoder error', err);
    }
    const audioDecoder = new WsAudioDecoder({
      output: demuxAndPlay,
      error: onDecoderError,
    });
    this.audioDecoder = audioDecoder;
    
    const audioWorkletNode = new AudioWorkletNode(getAudioContext(), 'ws-output-worklet');
    audioWorkletNode.port.onmessage = e => {
      const {method} = e.data;
      switch (method) {
        case 'volume': {
          const {args: {value}} = e.data;
          this.volume.readUpdate(value);
          break;
        }
      }
    };
    this.addEventListener('leave', () => {
      audioWorkletNode.disconnect();
      audioDecoder.close();
    });
    
    this.audioNode = audioWorkletNode;
  }
  toJSON() {
    const {id} = this;
    return {
      id,
    };
  }
}
class LocalPlayer extends Player {
  constructor(id, parent) {
    super(id);
    this.parent = parent;
  }
  setPose(position = this.pose.position, quaternion = this.pose.quaternion, scale = this.pose.scale) {
    this.pose.set(position, quaternion, scale);
    this.pose.dispatchEvent(new MessageEvent('update'));
    
    if (this.id) {
      this.parent.pushUserPose(position, quaternion, scale);
    }
  }
  setMetadata(o) {
    this.metadata.set(o);

    const keys = Object.keys(o);
    if (keys.length > 0) {
      this.metadata.dispatchEvent(new MessageEvent('update', {
        data: {
          keys,
        },
      }));
    }
    
    if (this.id) {
      this.parent.pushUserMetadata(o);
    }
  }
}
class Entity {
  constructor(map, parent) {
    this.map = map;
    this.parent = parent;
    
    const _observe = (e, tx) => {
      const keysChanged = Array.from(e.keysChanged.values());
      if (keysChanged.includes('id') && this.map.get('id') === undefined) {
        this.map.unobserve(_observe);
      }
    };
    this.map.observe(_observe);
  }
  get(k) {
    return this.map.get(k);
  }
  toJSON() {
    return this.map.toJSON();
  }
  set(k, v) {
    if (k === 'id') {
      throw new Error('cannot edit id key');
    }
    this.parent.state.transact(() => {
      this.map.set(k, v);
    });
  }
  setJSON(o) {
    if ('id' in o) {
      throw new Error('cannot edit id key');
    }
    this.parent.state.transact(() => {
      for (const k in o) {
        this.map.set(k, o[k]);
      }
    });
  }
  delete(k) {
    if (k === 'id') {
      throw new Error('cannot edit id key');
    }
    this.parent.state.transact(() => {
      this.map.delete(k);
    });
  }
}
class Room extends EventTarget {
  constructor(parent) {
    super();

    this.state = new Y.Doc();
    this.parent = parent;

    let lastEntities = [];
    const entities = this.state.getArray(roomEntitiesPrefix);
    entities.observe(() => {
      const nextEntities = entities.toJSON();

      for (const id of nextEntities) {
        if (!lastEntities.includes(id)) {
          this.dispatchEvent(new MessageEvent('add', {
            data: {
              id,
            },
          }));
        }
      }
      for (const id of lastEntities) {
        if (!nextEntities.includes(id)) {
          this.dispatchEvent(new MessageEvent('remove', {
            data: {
              id,
            },
          }));
        }
      }

      lastEntities = nextEntities;
    });

    const _stateUpdate = uint8Array => {
      console.log('room state update', this.state.toJSON());
      
      const data = Y.encodeStateAsUpdate(this.state);
      this.parent.sendMessage([
        MESSAGE.ROOMSTATE,
        data,
      ]);
    };
    this.state.on('update', _stateUpdate);
  }
  getEntities() {
    const entities = this.state.getArray(roomEntitiesPrefix);
    const entitiesJson = entities.toJSON();
    return entitiesJson.map(id => {
      const map = this.state.getMap(roomEntitiesPrefix + '.' + id);
      return new Entity(map, this);
    });
  }
  getOrCreateEntity(id) {
    let result;
    this.state.transact(() => {
      const entities = this.state.getArray(roomEntitiesPrefix);
      const entitiesJson = entities.toJSON();
      if (!entitiesJson.includes(id)) {
        entities.push([id]);
      }

      const map = this.state.getMap(roomEntitiesPrefix + '.' + id);
      if (map.get('id') === undefined) {
        map.set('id', id);
      }
      result = new Entity(map, this);
    });
    return result;
  }
  removeEntity(id) {
    this.state.transact(() => {
      const entities = this.state.getArray(roomEntitiesPrefix);
      const entitiesJson = entities.toJSON();
      const removeIndex = entitiesJson.indexOf(id);
      if (removeIndex !== -1) {
        entities.delete(removeIndex, 1);

        const map = this.state.getMap(roomEntitiesPrefix + '.' + id);
        const keys = Array.from(map.keys());
        for (const key of keys) {
          map.delete(key);
        }
      }
    });
  }
}
class WSRTC extends EventTarget {
  constructor(u) {
    super();
    
    this.state = 'closed';
    this.ws = null;
    this.localUser = new LocalPlayer(0, this);
    this.users = new Map();
    this.room = new Room(this);
    this.mediaStream = null;
    this.audioEncoder = null;
    
    this.addEventListener('close', () => {
      this.users = new Map();
      this.disableMic();
      console.log('close');
    });
    this.addEventListener('join', e => {
      const player = e.data;
      console.log('join', player);
    });
    this.addEventListener('leave', e => {
      const player = e.data;
      console.log('leave', player);
    });

    const ws = new WebSocket(u);
    this.ws = ws;
    ws.binaryType = 'arraybuffer';
    ws.addEventListener('open', () => {
      const initialMessage = e => {
        const uint32Array = new Uint32Array(e.data, 0, Math.floor(e.data.byteLength/Uint32Array.BYTES_PER_ELEMENT));
        const method = uint32Array[0];
        // console.log('got data', e.data, 0, Math.floor(e.data.byteLength/Uint32Array.BYTES_PER_ELEMENT), uint32Array, method);

        console.log('got method', method);

        switch (method) {
          case MESSAGE.INIT: {
            // local user
            let index = Uint32Array.BYTES_PER_ELEMENT;
            const id = uint32Array[index/Uint32Array.BYTES_PER_ELEMENT];
            this.localUser.id = id;
            index += Uint32Array.BYTES_PER_ELEMENT;
            
            // users
            const usersDataByteLength = uint32Array[index/Uint32Array.BYTES_PER_ELEMENT];
            index += Uint32Array.BYTES_PER_ELEMENT;
            const usersData = new Uint32Array(e.data, index, usersDataByteLength/Uint32Array.BYTES_PER_ELEMENT);
            for (let i = 0; i < usersData.length; i++) {
              const userId = usersData[i];
              const player = new Player(userId);
              this.users.set(userId, player);
              this.dispatchEvent(new MessageEvent('join', {
                data: player,
              }));
            }
            index += usersData.byteLength;
            
            // room
            const roomDataByteLength = uint32Array[index/Uint32Array.BYTES_PER_ELEMENT];
            index += Uint32Array.BYTES_PER_ELEMENT;
            const data = new Uint8Array(e.data, index, roomDataByteLength);
            Y.applyUpdate(this.room.state, data);
            index += data.byteLength;
            
            // log
            console.log('init', {
              id: this.localUser.id,
              users: Array.from(this.users.values()).map(user => user.toJSON()),
              roomState: this.room.state.toJSON(),
            });
            
            // finish setup
            ws.removeEventListener('message', initialMessage);
            ws.addEventListener('message', mainMessage);
            ws.addEventListener('close', e => {
              this.state = 'closed';
              this.ws = null;
              this.dispatchEvent(new MessageEvent('close'));
            });
            
            // emit open event
            this.state = 'open';
            this.dispatchEvent(new MessageEvent('open'));
            
            // latch local user id
            this.localUser.id = id;
            
            // send initial pose/metadata
            this.pushUserState();
            
            break;
          }
        }
      };
      const mainMessage = e => {
        // console.log('got message', e.data);
        
        const uint32Array = new Uint32Array(e.data, 0, Math.floor(e.data.byteLength/Uint32Array.BYTES_PER_ELEMENT));
        const method = uint32Array[0];
        // console.log('got data', e.data, 0, Math.floor(e.data.byteLength/Uint32Array.BYTES_PER_ELEMENT), uint32Array, method);

        switch (method) {
          case MESSAGE.JOIN: {
            // register the user locally
            const id = uint32Array[1];
            const player = new Player(id);
            this.users.set(id, player);
            player.dispatchEvent(new MessageEvent('join'));
            this.dispatchEvent(new MessageEvent('join', {
              data: player,
            }));
            // update the new user about ourselves
            this.pushUserState();
            break;
          }
          case MESSAGE.LEAVE: {
            const id = uint32Array[1];
            const player = this.users.get(id);
            if (player) {
              this.users.delete(id);
              player.dispatchEvent(new MessageEvent('leave'));
              this.dispatchEvent(new MessageEvent('leave', {
                data: player,
              }));
            } else {
              console.warn('leave message for unknown user ' + id);
            }
            break;
          }
          case MESSAGE.POSE: {
            const id = uint32Array[1];

            const player = this.users.get(id);
            if (player) {
              const poseBuffer = new Float32Array(e.data, 2 * Uint32Array.BYTES_PER_ELEMENT, 3 + 4 + 3);
              player.pose.readUpdate(poseBuffer);
            } else {
              console.warn('message for unknown player ' + id);
            }
            break;
          }
          case MESSAGE.AUDIO: {
            const id = uint32Array[1];
            const player = this.users.get(id);
            if (player) {
              const type = uint32Array[2] === 0 ? 'key' : 'delta';
              const float32Array = new Float32Array(e.data, 0, Math.floor(e.data.byteLength/Uint32Array.BYTES_PER_ELEMENT));
              const timestamp = float32Array[3];
              const duration = float32Array[4];
              const byteLength = uint32Array[5];
              const data = new Uint8Array(e.data, 6 * Uint32Array.BYTES_PER_ELEMENT, byteLength);
              
              const encodedAudioChunk = new WsEncodedAudioChunk({
                type: 'key', // XXX: hack! when this is 'delta', you get Uncaught DOMException: Failed to execute 'decode' on 'AudioDecoder': A key frame is required after configure() or flush().
                timestamp,
                duration,
                data,
              });
              player.audioDecoder.decode(encodedAudioChunk);
            } else {
              console.warn('message for unknown player ' + id);
            }
            break;
          }
          case MESSAGE.USERSTATE: {
            const id = uint32Array[1];
            const player = this.users.get(id);
            if (player) {
              const byteLength = uint32Array[2];
              const b = new Uint8Array(e.data, 3 * Uint32Array.BYTES_PER_ELEMENT, byteLength);
              const s = textDecoder.decode(b);
              const o = JSON.parse(s);
              player.metadata.readUpdate(o);
            } else {
              console.warn('message for unknown player ' + id);
            }
            break;
          }
          case MESSAGE.ROOMSTATE: {
            const byteLength = uint32Array[1];
            const data = new Uint8Array(e.data, 2 * Uint32Array.BYTES_PER_ELEMENT, byteLength);
            Y.applyUpdate(this.room.state, data);
            break;
          }
          default: {
            console.warn('unknown method id: ' + method);
            break;
          }
        }
      };
      ws.addEventListener('message', initialMessage);
    });
    ws.addEventListener('error', err => {
      this.dispatchEvent(new MessageEvent('error', {
        data: err,
      }));
    });
  }
  pushUserState() {
    if (this.localUser.id) {
      this.pushUserPose(this.localUser.pose.position, this.localUser.pose.quaternion, this.localUser.pose.scale);
      this.pushUserMetadata(this.localUser.metadata.data);
    }
  }
  pushUserPose(p, q, s) {
    if (this.localUser.id) {
      const data = new Float32Array(3 + 4 + 3);
      const position = new Float32Array(data.buffer, 0, 3);
      position.set(p);
      const quaternion = new Float32Array(data.buffer, 3*Float32Array.BYTES_PER_ELEMENT, 4);
      quaternion.set(q);
      const scale = new Float32Array(data.buffer, (3+4)*Float32Array.BYTES_PER_ELEMENT, 3);
      scale.set(s);
      data.staticSize = true;
      this.sendMessage([
        MESSAGE.POSE,
        this.localUser.id,
        data,
      ]);
    }
  }
  pushUserMetadata(o) {
    if (this.localUser.id) {
      this.sendMessage([
        MESSAGE.USERSTATE,
        this.localUser.id,
        JSON.stringify(o),
      ]);
    }
  }
  sendMessage(parts) {
    this.ws.send(encodeMessage(parts));
  }
  close() {
    if (this.state === 'open') {
      this.ws.disconnect();
    } else {
      throw new Error('connection not open');
    }
  }
  async enableMic() {
    if (this.state !== 'open') {
      throw new Error('connection not open');
    }
    if (this.mediaStream) {
      throw new Error('mic already enabled');
    }
    
    this.mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount,
        sampleRate,
      },
    });

    const audioReader = new WsMediaStreamAudioReader(this.mediaStream);
    
    const muxAndSend = encodedChunk => {
      // console.log('got chunk', encodedChunk);
      const {type, timestamp, duration} = encodedChunk;
      
      const timestampDurationBuffer = Float32Array.from([timestamp, duration]);
      timestampDurationBuffer.staticSize = true;
      
      const data = getEncodedAudioChunkBuffer(encodedChunk);
      this.sendMessage([
        MESSAGE.AUDIO,
        this.localUser.id,
        type === 'key' ? 0 : 1,
        timestampDurationBuffer,
        data,
      ]);
    };
    function onEncoderError(err) {
      console.warn('encoder error', err);
    }
    const audioEncoder = new WsAudioEncoder({
      output: muxAndSend,
      error: onEncoderError,
    });
    this.audioEncoder = audioEncoder;
    
    async function readAndEncode() {
      const result = await audioReader.read();
      if (!result.done) {
        audioEncoder.encode(result.value);
        readAndEncode();
      }
    }
    
    readAndEncode();
  }
  disableMic() {
    if (this.mediaStream) {
      this.mediaStream.close();
      this.mediaStream = null;
    }
    if (this.audioEncoder) {
      this.audioEncoder.close();
      this.audioEncoder = null;
    }
  }
}
WSRTC.waitForReady = async () => {
  await ensureAudioContext();
};
WSRTC.getAudioContext = getAudioContext;

export default WSRTC;