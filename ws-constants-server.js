module.exports.MESSAGE = (() => {
  let i = 1;
  return {
    INIT: i++,
    JOIN: i++,
    LEAVE: i++,
    POSE: i++,
    AUDIO: i++,
    USERSTATE: i++,
    ROOMSTATE: i++,
  };
})();