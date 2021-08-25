import {getAudioContext} from './ws-audio-context.js';
import {getAudioDataBuffer} from './ws-util.js';
import {channelCount, sampleRate, bitrate} from './ws-constants.js';

// WebCodec suport

/* export const WsEncodedAudioChunk = EncodedAudioChunk;

export function WsMediaStreamAudioReader(mediaStream) {
  const audioTracks = mediaStream.getAudioTracks();
  const audioTrack = audioTracks[0];
  const audio = (new MediaStreamTrackProcessor(audioTrack)).readable;
  const audioReader = audio.getReader();
  return audioReader;
}

export function WsAudioEncoder({output, error}) {
  const audioEncoder = new AudioEncoder({
    output,
    error,
  });
  audioEncoder.configure({
    codec: 'opus',
    numberOfChannels: channelCount,
    sampleRate,
    bitrate,
  });
  return audioEncoder;
}

export function WsAudioDecoder({output, error}) {
  const audioDecoder = new AudioDecoder({
    output,
    error,
  });
  audioDecoder.configure({
    codec: 'opus',
    numberOfChannels: channelCount,
    sampleRate,
  });
  return audioDecoder;
} */

// NO WebCodec suport

function makeFakeAudioData(data) {
  return {
    buffer: {
      getChannelData(n) {
        return data;
      },
    },
  };
}
export class WsMediaStreamAudioReader {
  constructor(mediaStream) {
    this.buffers = [];
    this.cbs = [];
    
    const audioCtx = getAudioContext();
    
    const mediaStreamSourceNode = audioCtx.createMediaStreamSource(mediaStream);
    
    const audioWorkletNode = new AudioWorkletNode(audioCtx, 'ws-input-worklet');
    audioWorkletNode.port.onmessage = e => {
      this.buffers.push(e.data);
      _flush();
    };
    
    mediaStreamSourceNode.connect(audioWorkletNode);
    audioWorkletNode.connect(audioCtx.destination);
    
    const _flush = () => {
      while (this.buffers.length > 0 && this.cbs.length > 0) {
        this.cbs.shift()(this.buffers.shift());
      }
    };
    mediaStream.addEventListener('close', e => {
      audioWorkletNode.disconnect();
      
      this.buffers.push(null);
      _flush();
    });
  }
  read() {
    const _makeResult = b => {
      if (b) {
        const value = makeFakeAudioData(b);
        return {
          value,
          done: false,
        };
      } else {
        return {
          value: null,
          done: true,
        };
      }

    };
    if (this.buffers.length > 0) {
      const result = _makeResult(this.buffers.shift());
      return Promise.resolve(result);
    } else {
      let accept;
      const p = new Promise((a, r) => {
        accept = a;
      });
      this.cbs.push(b => {
        const result = _makeResult(b);
        accept(result);
      });
      return p;
    }
  }
}

export function WsEncodedAudioChunk(o) {
  return o;
}

export class WsAudioEncoder {
  constructor({output, error}) {
    this.worker = new Worker('ws-codec-worker.js', {
      type: 'module',
    });
    this.worker.onmessage = e => {
      const {args: {data}} = e.data;
      const encodedChunk = {
        data,
      };
      output(encodedChunk);
    };
    this.worker.onerror = error;
  }
  encode(audioData) {
    const channelData = getAudioDataBuffer(audioData);
    this.worker.postMessage({
      method: 'encode',
      args: {
        data: channelData,
      },
    }, [channelData.buffer]);
  }
  close() {
    this.worker.terminate();
  }
}

export class WsAudioDecoder {
  constructor({output, error}) {
    this.worker = new Worker('ws-codec-worker.js', {
      type: 'module',
    });
    this.worker.onmessage = e => {
      const {args: {data}} = e.data;
      const audioData = makeFakeAudioData(data);
      output(audioData);
    };
    this.worker.onerror = error;
  }
  decode(encodedAudioChunk) {
    const {data} = encodedAudioChunk;
    this.worker.postMessage({
      method: 'decode',
      args: {
        data,
      },
    }, [data.buffer]);
  }
  close() {
    this.worker.terminate();
  }
}