import OpusScript from './opusscript/opusscript.js';
import {channelCount, sampleRate, bitrate} from './ws-constants.js';

const encoder = new OpusScript(sampleRate, channelCount, OpusScript.Application.AUDIO);
// console.log('got', encoder);

const muxAndSend = encodedChunk => {
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
function onEncoderError(err) {
  console.warn('encoder error', err);
}
const audioEncoder = new AudioEncoder({
  output: muxAndSend,
  error: onEncoderError,
});
audioEncoder.configure({
  codec: 'opus',
  numberOfChannels: channelCount,
  sampleRate,
  bitrate,
});

onmessage = e => {
  const {method} = e.data;
  switch (method) {
    case 'encode': {
      const {args: {data}} = e.data;
      break;
    }
  }
};