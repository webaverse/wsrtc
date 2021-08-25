import libopus from './libopusjs/libopus.wasm.js';
import {channelCount, sampleRate, bitrate} from './ws-constants.js';

// console.log('got libopus', libopus);

(async () => {
  await libopus.waitForReady();
  const {Encoder, Decoder} = libopus;

  const frameSize = 20;
  const voiceOptimization = false;
  const enc = new libopus.Encoder(channelCount, sampleRate, bitrate, frameSize, voiceOptimization);
  const dec = new libopus.Decoder(channelCount, sampleRate);

  for(;;) {
    var samples = new Int16Array(2048);
    for(var k = 0; k < samples.length; k++) {
      samples[k] = Math.random()*30000;
    }
    enc.input(samples);
    const data = enc.output();
    if (data) {
      console.log('got data', data);
      
      dec.input(data);
      const result = dec.output();
      console.log('got result', result);

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