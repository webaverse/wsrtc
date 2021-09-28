const textEncoder = new TextEncoder();
const encodedMessageUint8Array = new Uint8Array(64 * 1024);
const encodedMessageDataView = new DataView(encodedMessageUint8Array.buffer, encodedMessageUint8Array.byteOffset);
module.exports.encodeMessage = parts => {
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