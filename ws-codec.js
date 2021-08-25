/* const muxAndSend = encodedChunk => {
  // console.log('got chunk', encodedChunk);
  const {type, timestamp, duration} = encodedChunk;
  const byteLength = encodedChunk.copyTo ?
    encodedChunk.byteLength
  :
    encodedChunk.data.byteLength;
  const data = new Uint8Array(
    Uint32Array.BYTES_PER_ELEMENT +
    byteLength
  );
  const uint32Array = new Uint32Array(data.buffer, data.byteOffset, 1);
  uint32Array[0] = this.localUser.id;
  if (!this.localUser.id) {
    debugger;
  }
  if (encodedChunk.copyTo) { // new api
    encodedChunk.copyTo(new Uint8Array(data.buffer, data.byteOffset + Uint32Array.BYTES_PER_ELEMENT));
  } else { // old api
    data.set(new Uint8Array(encodedChunk.data), Uint32Array.BYTES_PER_ELEMENT);
  }
  this.ws.send(JSON.stringify({
    method: 'audio',
    id: this.localUser.id,
    args: {
      type,
      timestamp,
      duration,
    },
  }));
  this.ws.send(data);
};
const audioEncoder = new AudioEncoder({
  output: muxAndSend,
  error: onEncoderError,
});
audioEncoder.configure({
  codec: 'opus',
  numberOfChannels: channelCount,
  sampleRate,
  bitrate,
}); */

export function WsMediaStreamAudioReader(mediaStream) {
  const audioTracks = mediaStream.getAudioTracks();
  const audioTrack = audioTracks[0];
  const audio = (new MediaStreamTrackProcessor(audioTrack)).readable;
  const audioReader = audio.getReader();
  return audioReader;
}

/* export class WsAudioReader {
  contructor(mediaStream) {

  }
} */

export class WsOpusEncoder {
  contructor() {
    this.worker = new Worker('ws-codec-worker.js');
  }
}

export class WsOpusDecoder {
  constructor() {
    this.worker = new Worker('ws-codec-worker.js');
  }
}