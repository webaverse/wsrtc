import XRRTC from './xrrtc.js';

const form = document.getElementById('form');
const input = form.querySelector('input[type=text]');
function parseQuery(queryString) {
    var query = {};
    var pairs = (queryString[0] === '?' ? queryString.substr(1) : queryString).split('&');
    for (var i = 0; i < pairs.length; i++) {
        var pair = pairs[i].split('=');
        query[decodeURIComponent(pair[0])] = decodeURIComponent(pair[1] || '');
    }
    return query;
}
const qs = parseQuery(location.search);
input.value = qs.u || `wss://${location.host}`;
form.addEventListener('submit', e => {
  e.preventDefault();
  
  form.style.display = 'none';

  const _startXrrtc = async () => {
    await XRRTC.waitForReady();
    const xrrtc = new XRRTC(input.value);
    xrrtc.addEventListener('open', e => {
      xrrtc.localUser.setPose(
        Float32Array.from([1, 2, 3]),
        Float32Array.from([1, 0, 0, 0]),
        Float32Array.from([3, 3, 3]),
      );
      
      function makeid(length) {
        let result = '';
        const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        for (let i = 0; i < length; i++) {
          result += characters.charAt(Math.floor(Math.random() * characters.length));
        }
        return result;
      }
      const name = makeid(5);
      xrrtc.localUser.setMetadata({
        name,
      });
      
      xrrtc.enableMic();
    });
    xrrtc.addEventListener('join', e => {
      const player = e.data;
      player.audioNode.connect(XRRTC.getAudioContext().destination);
      player.pose.addEventListener('update', e => {
        console.log('pose update', player.id, player.pose.position, player.pose.quaternion, player.pose.scale);
      });
      player.metadata.addEventListener('update', e => {
        console.log('metadata update', player.id, player.metadata.toJSON());
      });
      player.addEventListener('volume', e => {
        // console.log('volume', e.data);
      });
      player.addEventListener('leave', e => {
        console.log('leave', player);
      });
    });
  };
  _startXrrtc();
}, {
  once: true,
});