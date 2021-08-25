import {channelCount, sampleRate, bitrate} from './ws-constants.js';

// WebCodec suport

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

export class WsAudioEncoder {
  contructor({output, error}) {
    this.worker = new Worker('ws-codec-worker.js');
  }
}

export class WsAudioDecoder {
  constructor({output, error}) {
    this.worker = new Worker('ws-codec-worker.js');
  }
} */