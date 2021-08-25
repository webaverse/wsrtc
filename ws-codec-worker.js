import libopus from './libopusjs/libopus.wasm.js';
import {channelCount, sampleRate, bitrate} from './ws-constants.js';

const frameSize = 20;
const voiceOptimization = true;

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

/* (async () => {
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
})(); */

const loadPromise = (async () => {
  await libopus.waitForReady();

  const enc = new libopus.Encoder(channelCount, sampleRate, bitrate, frameSize, voiceOptimization);
  const dec = new libopus.Decoder(channelCount, sampleRate);
  return {enc, dec};
})();

onmessage = async e => {
  const {method} = e.data;
  switch (method) {
    case 'encode': {
      const {args: {data}} = e.data;
      
      const {enc} = await loadPromise;
      const samples = floatTo16Bit(data);
      enc.input(samples);
      
      let output;
      while (output = enc.output()) {
        output = output.slice();
        postMessage({
          method: 'encode',
          args: {
            data: output,
          },
        }, [output.buffer]);
      }
      
      break;
    }
    case 'decode': {
      const {args: {data}} = e.data;
      
      const {dec} = await loadPromise;
      dec.input(data);

      let output;
      while (output = dec.output()) {
        const result2 = int16ToFloat32(output);
        
        postMessage({
          method: 'decode',
          args: {
            data: result2,
          },
        }, [result2.buffer]);
      }
      break;
    }
    default: {
      console.warn('unknown method: ' + method);
      break;
    }
  }
};