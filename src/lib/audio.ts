// 音效與背景音樂都用 Web Audio 即時合成（原創，無授權問題）。預設音量偏低，適合電腦教室。
type Sfx = "click" | "plant" | "water" | "harvest" | "ok" | "soft" | "coin" | "order" | "levelup";

let ctx: AudioContext | null = null;
let vol = { sfx: 0.4, music: 0.15, muted: false };
let musicTimer = 0;

const ac = () => (ctx ??= new AudioContext());

function note(freq: number, start: number, dur: number, gain: number, type: OscillatorType = "sine") {
  if (vol.muted || gain <= 0) return;
  const c = ac(), o = c.createOscillator(), g = c.createGain(), t = c.currentTime + start;
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(c.destination); o.start(t); o.stop(t + dur + 0.05);
}

const SFX: Record<Sfx, [number, number, number][]> = {
  click: [[660, 0, 0.06]],
  ok: [[880, 0, 0.08]],
  soft: [[330, 0, 0.18]],                       // 溫和的錯誤提示，不刺耳
  plant: [[392, 0, 0.12], [523, 0.08, 0.15]],
  water: [[784, 0, 0.1], [659, 0.07, 0.1], [523, 0.14, 0.14]],
  harvest: [[523, 0, 0.1], [659, 0.08, 0.1], [784, 0.16, 0.2]],
  coin: [[988, 0, 0.08], [1319, 0.06, 0.15]],
  order: [[523, 0, 0.12], [659, 0.1, 0.12], [784, 0.2, 0.12], [1047, 0.3, 0.3]],
  levelup: [[523, 0, 0.15], [659, 0.12, 0.15], [784, 0.24, 0.15], [1047, 0.36, 0.4]],
};

export function sfx(kind: Sfx) {
  try { for (const [f, s, d] of SFX[kind]) note(f, s, d, vol.sfx * 0.25, "triangle"); } catch { /* 沒有音效裝置 */ }
}

// 背景音樂：五聲音階的輕柔旋律，8 小節循環
const MELODY = [523, 587, 659, 784, 659, 587, 523, 440, 392, 440, 523, 587, 523, 440, 392, 0];
function startMusic() {
  stopMusic();
  if (vol.muted || vol.music <= 0) return;
  let i = 0;
  musicTimer = window.setInterval(() => {
    const f = MELODY[i++ % MELODY.length];
    try { if (f) note(f, 0, 0.5, vol.music * 0.12); } catch { stopMusic(); }
  }, 520);
}
const stopMusic = () => { clearInterval(musicTimer); musicTimer = 0; };

/** 由 App 在設定改變時呼叫；瀏覽器規定要使用者點擊後才能播放聲音。 */
export function configureAudio(v: typeof vol, userStarted: boolean) {
  const musicChanged = v.music !== vol.music || v.muted !== vol.muted;
  vol = { ...v };
  if (userStarted && (musicChanged || !musicTimer)) startMusic();
}
