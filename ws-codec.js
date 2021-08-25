import {getAudioDataBuffer} from './ws-util.js';
import {channelCount, sampleRate, bitrate} from './ws-constants.js';

// WebCodec suport

export const WsEncodedAudioChunk = EncodedAudioChunk;

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
}

// NO WebCodec suport

/* export class WsMediaStreamAudioReader {
  contructor(mediaStream) {

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
      const audioData = {
        buffer: {
          getChannelData(n) {
            return data;
          },
        },
      };
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
} */