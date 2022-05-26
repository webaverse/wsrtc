import {channelCount, sampleRate, bitrate} from './ws-constants.js';
import Avatar from '../../avatars/avatars.js';
let audioCtx = null;
export const ensureAudioContext = async () => {
  if (!audioCtx && Avatar.audioContext) {
    
    audioCtx = Avatar.audioContext;
    await Promise.all([
      audioCtx.audioWorklet.addModule(`${import.meta.url.replace(/(\/)[^\/]*$/, '$1')}ws-input-worklet.js`),
      audioCtx.audioWorklet.addModule(`${import.meta.url.replace(/(\/)[^\/]*$/, '$1')}ws-output-worklet.js`),
    ]);
  }
};
export const getAudioContext = () => {
  ensureAudioContext();
  return audioCtx;
};