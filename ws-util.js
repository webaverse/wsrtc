import {TYPE} from './ws-constants.js';

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();
const encodedMessageUint8Array = new Uint8Array(4096);
const encodedMessageDataView = new DataView(encodedMessageUint8Array.buffer);
export const encodeMessage = parts => {
  let index = 0;
  for (const part of parts) {
    if (typeof part === 'number') {
      encodedMessageDataView.setUint32(index, part, true);
      index += Uint32Array.BYTES_PER_ELEMENT;
    } else if (typeof part === 'string') {
      const {written} = textEncoder.encodeInto(part, new Uint8Array(encodedMessageUint8Array.buffer, encodedMessageUint8Array.byteOffset + index + Uint32Array.BYTES_PER_ELEMENT));
      encodedMessageDataView.setUint32(index, written, true);
      index += Uint32Array.BYTES_PER_ELEMENT;
      index += written;
    } else if (part.byteLength >= 0) {
      if (!part.staticSize) {
        encodedMessageDataView.setUint32(index, part.byteLength, true);
        index += Uint32Array.BYTES_PER_ELEMENT;
      }
      encodedMessageUint8Array.set(new Uint8Array(part.buffer, part.byteOffset, part.byteLength), index);
      index += part.byteLength;
    } else {
      throw new Error('unknown part: ' + JSON.stringify(part));
    }
  }
  return new Uint8Array(encodedMessageUint8Array.buffer, encodedMessageUint8Array.byteOffset, index);
};
const _align = (index, n) => index + (n - (index % n));
const _align4 = index => _align(index, 4);
export const encodeTypedMessage = (uint8Array, parts) => {
  const uint32Array = new Uint32Array(uint8Array.buffer, uint8Array.byteOffset, uint8Array.byteLength/Uint32Array.BYTES_PER_ELEMENT);
  const float32Array = new Float32Array(uint8Array.buffer, uint8Array.byteOffset, uint8Array.byteLength/Float32Array.BYTES_PER_ELEMENT);
  
  let index = 0;
  for (const part of parts) {
    if (typeof part === 'number') {
      if (Number.isInteger(part)) {
        uint32Array[index/Uint32Array.BYTES_PER_ELEMENT] = TYPE.INT;
        index += Uint32Array.BYTES_PER_ELEMENT;
        uint32Array[index/Uint32Array.BYTES_PER_ELEMENT] = part;
        index += Uint32Array.BYTES_PER_ELEMENT;
      } else {
        uint32Array[index/Uint32Array.BYTES_PER_ELEMENT] = TYPE.FLOAT;
        index += Uint32Array.BYTES_PER_ELEMENT;
        float32Array[index/Float32Array.BYTES_PER_ELEMENT] = part;
        index += Uint32Array.BYTES_PER_ELEMENT;
      }
    } else if (typeof part === 'string') {
      uint32Array[index/Uint32Array.BYTES_PER_ELEMENT] = TYPE.STRING;
      index += Uint32Array.BYTES_PER_ELEMENT;
      
      const {written} = textEncoder.encodeInto(part, new Uint8Array(uint8Array.buffer, uint8Array.byteOffset + index + Uint32Array.BYTES_PER_ELEMENT));
      uint32Array[index/Uint32Array.BYTES_PER_ELEMENT] = written;
      index += Uint32Array.BYTES_PER_ELEMENT;
      index += written;
      index = _align4(index);
    } else if (part instanceof Uint32Array) {
      uint32Array[index/Uint32Array.BYTES_PER_ELEMENT] = TYPE.UINT32ARRAY;
      index += Uint32Array.BYTES_PER_ELEMENT;
      uint32Array[index/Uint32Array.BYTES_PER_ELEMENT] = part.length;
      index += Uint32Array.BYTES_PER_ELEMENT;
      
      uint32Array.set(part, index/Uint32Array.BYTES_PER_ELEMENT);
      index += part.byteLength;
    } else if (part instanceof Float32Array) {
      uint32Array[index/Uint32Array.BYTES_PER_ELEMENT] = TYPE.FLOAT32ARRAY;
      index += Uint32Array.BYTES_PER_ELEMENT;
      uint32Array[index/Uint32Array.BYTES_PER_ELEMENT] = part.length;
      index += Uint32Array.BYTES_PER_ELEMENT;
      
      float32Array.set(part, index/Float32Array.BYTES_PER_ELEMENT);
      index += part.byteLength;
    } else if (part instanceof Uint8Array) {
      uint32Array[index/Uint32Array.BYTES_PER_ELEMENT] = TYPE.UINT32ARRAY;
      index += Uint32Array.BYTES_PER_ELEMENT;
      uint32Array[index/Uint32Array.BYTES_PER_ELEMENT] = part.length;
      index += Uint32Array.BYTES_PER_ELEMENT;
      
      uint8Array.set(part, index);
      index += part.byteLength;
      index = _align4(index);
    } else {
      throw new Error('unknown part: ' + JSON.stringify(part));
    }
  }
  return index;
};
export const decodeTypedMessage = (uint8Array, uint8ArrayByteLength, parts) => {
  const uint32Array = new Uint32Array(uint8Array.buffer, uint8Array.byteOffset, uint8ArrayByteLength/Uint32Array.BYTES_PER_ELEMENT);
  const float32Array = new Float32Array(uint8Array.buffer, uint8Array.byteOffset, uint8ArrayByteLength/Float32Array.BYTES_PER_ELEMENT);
  
  parts.length = 0;
  for (let index = 0; index < uint8ArrayByteLength;) {
    const type = uint32Array[index/Uint32Array.BYTES_PER_ELEMENT];
    index += Uint32Array.BYTES_PER_ELEMENT;

    switch (type) {
      case TYPE.INT: {
        const part = uint32Array[index/Uint32Array.BYTES_PER_ELEMENT];
        parts.push(part);
        index += Uint32Array.BYTES_PER_ELEMENT;
        break;
      }
      case TYPE.FLOAT: {
        const part = float32Array[index/Float32Array.BYTES_PER_ELEMENT];
        parts.push(part);
        index += Float32Array.BYTES_PER_ELEMENT;
        break;
      }
      case TYPE.STRING: {
        const byteLength = uint32Array[index/Uint32Array.BYTES_PER_ELEMENT];
        index += Uint32Array.BYTES_PER_ELEMENT;
        
        const b = new Uint8Array(uint8Array.buffer, index, byteLength);
        const part = textDecoder.decode(b);
        parts.push(part);
        index += byteLength;
        index = _align4(index);
        break;
      }
      case TYPE.UINT32ARRAY: {
        const length = uint32Array[index/Uint32Array.BYTES_PER_ELEMENT];
        index += Uint32Array.BYTES_PER_ELEMENT;
        
        const part = new Uint32Array(uint8Array.buffer, index, length);
        parts.push(part);
        index += part.byteLength;
        break;
      }
      case TYPE.FLOAT32ARRAY: {
        const length = uint32Array[index/Uint32Array.BYTES_PER_ELEMENT];
        index += Uint32Array.BYTES_PER_ELEMENT;
        
        const part = new Float32Array(uint8Array.buffer, index, length);
        parts.push(part);
        index += part.byteLength;
        break;
      }
      case TYPE.UINT8ARRAY: {
        const length = uint32Array[index/Uint32Array.BYTES_PER_ELEMENT];
        index += Uint32Array.BYTES_PER_ELEMENT;
        
        const part = new Uint8Array(uint8Array.buffer, index, length);
        parts.push(part);
        index += part.byteLength;
        index = _align4(index);
        break;
      }
      default: {
        throw new Error('cannot parse message part with type ' + type);
        break;
      }
    }
  }
};
export const getAudioDataBuffer = audioData => {
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
  return channelData;
};
export const getEncodedAudioChunkBuffer = encodedAudioChunk => {
  if (encodedAudioChunk.copyTo) { // new api
    const data = new Uint8Array(encodedAudioChunk.byteLength);
    encodedAudioChunk.copyTo(data);
    return data;
  } else { // old api
    return new Uint8Array(encodedAudioChunk.data);
  }
};