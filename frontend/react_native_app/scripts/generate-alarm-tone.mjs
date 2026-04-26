// Generate a classic two-tone alarm clock beep as a WAV file.
//
// This is a tiny pure-Node script that writes a PCM WAV (no native deps,
// no audio libs). The result is a 2 s loopable alarm tone made of two
// alternating sine pulses (880 Hz then 660 Hz, ~250 ms each, with a
// short gap) — recognisable as an alarm and pleasant enough to hear
// repeatedly.

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outPath = resolve(__dirname, '../assets/sounds/alarm.wav');

const SAMPLE_RATE = 22050;
const BITS_PER_SAMPLE = 16;
const NUM_CHANNELS = 1;

function pulse(freq, durationMs, volume = 0.7) {
  const samples = Math.round((SAMPLE_RATE * durationMs) / 1000);
  const out = new Int16Array(samples);
  // Short attack + release envelope to avoid clicks.
  const attack = Math.min(800, samples / 8);
  const release = Math.min(800, samples / 8);
  for (let i = 0; i < samples; i++) {
    let env = 1;
    if (i < attack) env = i / attack;
    else if (i > samples - release) env = (samples - i) / release;
    const v = Math.sin((2 * Math.PI * freq * i) / SAMPLE_RATE) * volume * env;
    out[i] = Math.round(v * 32767);
  }
  return out;
}

function silence(durationMs) {
  return new Int16Array(Math.round((SAMPLE_RATE * durationMs) / 1000));
}

function concat(...chunks) {
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const out = new Int16Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.length;
  }
  return out;
}

// One full ~2 s cycle: high beep, gap, low beep, gap, high beep, gap.
const cycle = concat(
  pulse(880, 250),
  silence(120),
  pulse(660, 250),
  silence(120),
  pulse(880, 250),
  silence(1000),
);

function makeWav(samples) {
  const byteRate = (SAMPLE_RATE * NUM_CHANNELS * BITS_PER_SAMPLE) / 8;
  const blockAlign = (NUM_CHANNELS * BITS_PER_SAMPLE) / 8;
  const dataSize = samples.length * 2;
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // PCM chunk size
  buffer.writeUInt16LE(1, 20); // format = PCM
  buffer.writeUInt16LE(NUM_CHANNELS, 22);
  buffer.writeUInt32LE(SAMPLE_RATE, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(BITS_PER_SAMPLE, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);
  for (let i = 0; i < samples.length; i++) {
    buffer.writeInt16LE(samples[i], 44 + i * 2);
  }
  return buffer;
}

const wav = makeWav(cycle);
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, wav);
console.log(
  `[alarm] wrote ${wav.length} bytes (${(cycle.length / SAMPLE_RATE).toFixed(2)} s) -> ${outPath}`,
);
