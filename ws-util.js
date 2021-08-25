const textEncoder = new TextEncoder();
export const encodeMessage = parts => {
  let byteLength = 0;
  parts = parts.map(part => {
    if (typeof part === 'number') {
      byteLength += Uint32Array.BYTES_PER_ELEMENT;
      return part;
    } else if (typeof part === 'string') {
      const b = textEncoder.encode(part);
      byteLength += Uint32Array.BYTES_PER_ELEMENT;
      byteLength += b.byteLength;
      return b;
    } else if (typeof part.byteLength === 'number') {
      byteLength += Uint32Array.BYTES_PER_ELEMENT;
      byteLength += part.byteLength;
      return part;
    } else {
      throw new Error('unknown part: ' + JSON.stringify(part));
    }
  });

  const data = new Uint8Array(byteLength);
  const uint32Array = new Uint32Array(data.buffer, data.byteOffset, Math.floor(byteLength/Uint32Array.BYTES_PER_ELEMENT));
  let index = 0;
  for (const part of parts) {
    if (typeof part === 'number') {
      uint32Array[index/Uint32Array.BYTES_PER_ELEMENT] = part;
      index += Uint32Array.BYTES_PER_ELEMENT;
    } else {
      uint32Array[index/Uint32Array.BYTES_PER_ELEMENT] = part.byteLength;
      index += Uint32Array.BYTES_PER_ELEMENT;
      data.set(part, index);
      index += part.byteLength;
    }
  }
  return data;
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
  if (encodedChunk.copyTo) { // new api
    const data = new Uint8Array(encodedChunk.byteLength);
    encodedChunk.copyTo(data);
    return data;
  } else { // old api
    return new Uint8Array(encodedChunk.data);
  }
};