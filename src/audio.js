const sounds = {
  lantern: { wave: 'sine', frequencies: [880], duration: 0.08 },
  cleared: { wave: 'sine', frequencies: [660, 880], duration: 0.08 },
  failed: { wave: 'triangle', frequencies: [220, 110], duration: 0.1 },
  final: { wave: 'sine', frequencies: [660, 880, 1100], duration: 0.1 },
};

export function createAudio(createContext = () => new globalThis.AudioContext()) {
  let context = null;
  let master = null;
  let resuming = false;
  const voices = new Set();

  function disconnect(node) {
    try { node.disconnect(); } catch { /* A failed audio node must not stop the game. */ }
  }

  function stopAll() {
    for (const voice of voices) {
      try { voice.oscillator.stop(); } catch { /* Already ended or never started. */ }
      disconnect(voice.oscillator);
      disconnect(voice.gain);
    }
    voices.clear();
  }

  return {
    unlock() {
      try {
        if (!context) context = createContext();
        if (!master) {
          const gain = context.createGain();
          try {
            gain.gain.value = 0.10;
            gain.connect(context.destination);
          } catch (error) {
            disconnect(gain);
            throw error;
          }
          master = gain;
          context.onstatechange = () => {
            if (context.state !== 'running') stopAll();
          };
        }
        if (context.state === 'suspended' && !resuming) {
          resuming = true;
          Promise.resolve(context.resume()).catch(() => {}).finally(() => { resuming = false; });
        }
      } catch {
        resuming = false;
        // Unsupported or blocked audio leaves gameplay untouched, with no queued sound.
      }
    },
    play(name) {
      const sound = sounds[name];
      if (!sound || !context || !master || context.state !== 'running') return;
      stopAll();
      const start = context.currentTime;
      try {
        for (const [index, frequency] of sound.frequencies.entries()) {
          const gain = context.createGain();
          let oscillator;
          try {
            oscillator = context.createOscillator();
          } catch (error) {
            disconnect(gain);
            throw error;
          }
          const voice = { oscillator, gain };
          voices.add(voice);
          oscillator.onended = () => {
            disconnect(oscillator);
            disconnect(gain);
            voices.delete(voice);
          };
          const at = start + index * sound.duration;
          oscillator.type = sound.wave;
          oscillator.frequency.setValueAtTime(frequency, at);
          oscillator.connect(gain);
          gain.connect(master);
          gain.gain.setValueAtTime(0, at);
          gain.gain.linearRampToValueAtTime(1, at + 0.005);
          gain.gain.linearRampToValueAtTime(0, at + sound.duration);
          oscillator.start(at);
          oscillator.stop(at + sound.duration);
        }
      } catch {
        stopAll();
      }
    },
  };
}
