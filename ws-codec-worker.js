import libopus from './libopusjs/libopus.wasm.js';
import {channelCount, sampleRate, bitrate} from './ws-constants.js';

const frameSize = 20;
const voiceOptimization = false;

function floatTo16Bit(inputArray){
  const output = new Int16Array(inputArray.length);
  for (let i = 0; i < inputArray.length; i++){
    const s = Math.max(-1, Math.min(1, inputArray[i]));
    output[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
  }
  return output;
}
function int16ToFloat32(inputArray) {
  const output = new Float32Array(inputArray.length);
  for (let i = 0; i < inputArray.length; i++) {
    const int = inputArray[i];
    const float = (int >= 0x8000) ? -(0x10000 - int) / 0x8000 : int / 0x7FFF;
    output[i] = float;
  }
  return output;
}

(async () => {
  await libopus.waitForReady();
  const {Encoder, Decoder} = libopus;

  const enc = new libopus.Encoder(channelCount, sampleRate, bitrate, frameSize, voiceOptimization);
  const dec = new libopus.Decoder(channelCount, sampleRate);

  for(;;) {
    var samples = new Float32Array(2048);
    for(var k = 0; k < samples.length; k++) {
      samples[k] = Math.random();
    }
    const samples2 = floatTo16Bit(samples);
    enc.input(samples2);
    const data = enc.output();
    if (data) {
      console.log('got data', data);
      
      dec.input(data);
      const result = dec.output();
      const result2 = int16ToFloat32(result);
      console.log('got result', result2);

      break;
    }
  }

  /* // Decoder

  // create decoder
  // channels and samplerate should match the encoder options
  Decoder(channels, samplerate)

  // free decoder memory
  Decoder.destroy()

  // add packet to the decoder buffer
  // packet: Uint8Array
  Decoder.input(packet)

  // output the next decoded samples
  // return samples (interleaved if multiple channels) as Int16Array (valid until the next output call) or null if there is no output
  Decoder.output() */
})();

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
}); */

onmessage = e => {
  const {method} = e.data;
  switch (method) {
    case 'encode': {
      const {args: {data}} = e.data;
      break;
    }
  }
};