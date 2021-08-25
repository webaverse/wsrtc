class WsInputWorklet extends AudioWorkletProcessor {
  constructor (...args) {
    super(...args);
  }
  process(inputs, outputs, parameters) {
    const channels = inputs[0];
    const firstChannel = channels[0];
    const output = new Float32Array(firstChannel.length);
    for (let i = 0; i < firstChannel.length; i++) {
      for (let j = 0; j < channels.length; j++) {
        output[i] += channels[j][i];
      }
      output[i] /= channels.length;
    }
    // console.log('got samples', output);
    this.port.postMessage(output, [output.buffer]);
    return true;
  }
}
registerProcessor('ws-input-worklet', WsInputWorklet);