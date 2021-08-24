import XRRTC from './xrrtc.js';

const container = document.getElementById('container');
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
  
  const u = input.value;
  history.pushState({}, '', location.protocol + '//' + location.host + '?u=' + encodeURIComponent(u));
  form.style.display = 'none';

  const _createPlayerDom = player => {
    const playerEl = document.createElement('div');
    playerEl.classList.add('player');
    
    const volumeEl = document.createElement('div');
    volumeEl.classList.add('volume');
    playerEl.appendChild(volumeEl);
    
    container.appendChild(playerEl);
    player.addEventListener('leave', e => {
      container.removeChild(playerEl);
    });
    
    const _updatePlayerDomPosition = () => {
      playerEl.style.transform = `translate3d(${player.pose.position[0] * window.innerWidth}px, ${player.pose.position[1] * window.innerHeight}px, 0) scale(${1 - player.pose.position[2] * 0.2 + player.volume.value/10})`;
      playerEl.style.backgroundColor = player.pose.position[2] ? '#333' : null;
      volumeEl.style.height = `${player.volume.value * 100}%`;
      volumeEl.style.filter = `hue-rotate(${player.pose.position[2] ? 180 : 0}deg)`;
    };
    _updatePlayerDomPosition();
    player.pose.addEventListener('update', _updatePlayerDomPosition);
    player.volume.addEventListener('update', _updatePlayerDomPosition);
  };
  const _startXrrtc = async () => {
    await XRRTC.waitForReady();
    const xrrtc = new XRRTC(u);
    xrrtc.addEventListener('open', e => {
      xrrtc.localUser.setPose(
        Float32Array.from([1, 2, 0]),
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
      
      const mousemove = e => {
        const x = e.clientX / window.innerWidth;
        const y = e.clientY / window.innerHeight;
        xrrtc.localUser.setPose(
          Float32Array.from([
            x,
            y,
            xrrtc.localUser.pose.position[2],
          ]),
        );
      };
      const mousedown = e => {
        xrrtc.localUser.setPose(
          Float32Array.from([
            xrrtc.localUser.pose.position[0],
            xrrtc.localUser.pose.position[1],
            1,
          ]),
        );
      };
      const mouseup = e => {
        xrrtc.localUser.setPose(
          Float32Array.from([
            xrrtc.localUser.pose.position[0],
            xrrtc.localUser.pose.position[1],
            0,
          ]),
        );
      };
      document.addEventListener('mousemove', mousemove);
      document.addEventListener('mousedown', mousedown);
      document.addEventListener('mouseup', mouseup);
      xrrtc.addEventListener('close', e => {
        document.removeEventListener('mousemove', mousemove);
        document.removeEventListener('mousedown', mousedown);
        document.removeEventListener('mouseup', mouseup);
      });
    });
    xrrtc.addEventListener('join', e => {
      const player = e.data;
      player.audioNode.connect(XRRTC.getAudioContext().destination);
      player.pose.addEventListener('update', e => {
        // console.log('pose update', player.id, player.pose.position.join(','));
      });
      player.metadata.addEventListener('update', e => {
        console.log('metadata update', player.id, player.metadata.toJSON());
      });
      player.volume.addEventListener('volume', e => {
        // console.log('volume', e.data);
      });
      player.addEventListener('leave', e => {
        console.log('leave', player);
      });
      
      _createPlayerDom(player);
    });
  };
  _startXrrtc();
}, {
  once: true,
});