import { useEffect, useRef, useState } from 'react';
import { Mic, Square, Play, Trash2, AudioLines } from 'lucide-react';

export default function AudioRecorder({ onRecording }) {
  const [state, setState] = useState('idle'); // idle | recording | recorded
  const [seconds, setSeconds] = useState(0);
  const [playing, setPlaying] = useState(false);

  const mediaRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const audioRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => () => stop(), []);

  useEffect(() => {
    if (state !== 'recording') return;
    timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(timerRef.current);
  }, [state]);

  async function start() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      mediaRef.current = new MediaRecorder(stream);
      mediaRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mediaRef.current.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        onRecording(blob);
        if (audioRef.current) {
          audioRef.current.src = URL.createObjectURL(blob);
        }
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      };
      mediaRef.current.start();
      setSeconds(0);
      setState('recording');
    } catch {
      setState('idle');
      alert('Microphone access was denied. Enable it in your browser settings to record voice memos.');
    }
  }

  function stop() {
    if (mediaRef.current && mediaRef.current.state !== 'inactive') {
      mediaRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
    }
    if (timerRef.current) clearInterval(timerRef.current);
    setState('recorded');
    setSeconds(0);
  }

  function clear() {
    if (audioRef.current) {
      audioRef.current.src = '';
      audioRef.current.pause();
    }
    chunksRef.current = [];
    setPlaying(false);
    setState('idle');
    onRecording(null);
  }

  const mmss = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;

  return (
    <div
      className="rounded-xl border p-3"
      style={{ borderColor: 'rgb(var(--line))', backgroundColor: 'rgb(var(--surface-2))' }}
    >
      <div className="flex items-center gap-3">
        <AudioLines className="shrink-0" size={18} style={{ color: 'rgb(var(--faint))' }} />
        {state === 'idle' && (
          <button type="button" onClick={start} className="btn-primary">
            <Mic size={16} /> Record memo
          </button>
        )}
        {state === 'recording' && (
          <>
            <button type="button" onClick={stop} className="btn bg-rose-600 text-white hover:bg-rose-700">
              <Square size={16} /> Stop
            </button>
            <span className="animate-pulse text-sm font-bold text-rose-600">{mmss}</span>
          </>
        )}
        {state === 'recorded' && (
          <>
            <button type="button" onClick={() => audioRef.current?.play()} className="btn-outline">
              <Play size={16} /> Play
            </button>
            <button type="button" onClick={clear} className="btn-outline">
              <Trash2 size={16} /> Discard
            </button>
          </>
        )}
      </div>
      {state === 'recorded' && (
        <audio ref={audioRef} className="mt-2 w-full" onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} controls />
      )}
      {state !== 'idle' && state !== 'recording' && playing === false && null}
    </div>
  );
}
