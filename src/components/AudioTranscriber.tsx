import React, { useState, useRef } from 'react';
import { useTasks } from '../context/TaskContext';
import { Mic, MicOff, Play, Pause, RotateCcw, Copy, Check, Sparkles, FileAudio, AlertCircle } from 'lucide-react';

export const AudioTranscriber: React.FC = () => {
  const { completeTask, userStats } = useTasks();

  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioBase64, setAudioBase64] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcription, setTranscription] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [bountyClaimed, setBountyClaimed] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<any>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);

  const startRecording = async () => {
    setErrorMsg(null);
    setTranscription('');
    setAudioUrl(null);
    setAudioBase64(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(audioBlob);
        setAudioUrl(url);

        const reader = new FileReader();
        reader.onloadend = () => {
          const base64String = (reader.result as string).split(',')[1];
          setAudioBase64(base64String);
        };
        reader.readAsDataURL(audioBlob);

        // Stop media tracks
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start(200);
      setIsRecording(true);
      setRecordingSeconds(0);

      timerIntervalRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      console.error(err);
      setErrorMsg('Microphone access denied or not available. Please allow microphone permissions.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      clearInterval(timerIntervalRef.current);
    }
  };

  const handleTranscribe = async () => {
    if (!audioBase64) {
      setErrorMsg('Please record audio before transcribing.');
      return;
    }

    setIsTranscribing(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audioBase64,
          mimeType: 'audio/webm'
        })
      });

      const data = await res.json();
      if (data.text) {
        setTranscription(data.text);
      } else if (data.error) {
        setErrorMsg(data.error);
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg('Transcription service encountered an error.');
    } finally {
      setIsTranscribing(false);
    }
  };

  const handleClaimBounty = () => {
    if (bountyClaimed) return;
    completeTask('task-audio-transcribe-bonus', 2.20, 'Voice Audio Transcription Verification');
    setBountyClaimed(true);
  };

  const handleCopy = () => {
    navigator.clipboard?.writeText(transcription);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-200 p-6 md:p-8 shadow-xs space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
            <FileAudio className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Microphone Speech Transcription
            </h2>
            <p className="text-xs text-slate-500">
              Record voice notes or interview snippets to transcribe with <strong className="text-indigo-600 font-mono">gemini-3.5-transcribe</strong>.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-600 font-semibold bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg">
          <span>Earn $2.20 Transcription Bounty</span>
        </div>
      </div>

      {/* Recording workstation */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
        {/* Left: Mic Controls */}
        <div className="p-6 bg-slate-900 rounded-2xl text-white flex flex-col items-center justify-center space-y-4 shadow-lg min-h-[220px]">
          <div className="relative">
            {isRecording && (
              <span className="absolute -inset-3 rounded-full bg-rose-500/30 animate-ping" />
            )}
            <button
              type="button"
              onClick={isRecording ? stopRecording : startRecording}
              className={`w-16 h-16 rounded-full flex items-center justify-center transition-all ${
                isRecording
                  ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-lg shadow-rose-600/50'
                  : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-600/50'
              }`}
            >
              {isRecording ? <MicOff className="w-7 h-7" /> : <Mic className="w-7 h-7" />}
            </button>
          </div>

          <div className="text-center">
            <div className="text-lg font-mono font-bold tracking-wider tabular-nums">
              {formatTime(recordingSeconds)}
            </div>
            <p className="text-xs text-slate-400 mt-1">
              {isRecording
                ? 'Listening... Click again to finish recording'
                : audioUrl
                ? 'Recording ready. Transcribe below.'
                : 'Tap microphone to start speaking'}
            </p>
          </div>

          {audioUrl && (
            <div className="flex items-center gap-3 pt-2">
              <audio
                ref={audioElementRef}
                src={audioUrl}
                onPlay={() => setIsPlaying(true)}
                onEnded={() => setIsPlaying(false)}
                onPause={() => setIsPlaying(false)}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => {
                  if (isPlaying) {
                    audioElementRef.current?.pause();
                  } else {
                    audioElementRef.current?.play();
                  }
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 rounded-lg transition-colors"
              >
                {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                <span>{isPlaying ? 'Pause' : 'Play Audio'}</span>
              </button>

              <button
                type="button"
                onClick={startRecording}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 rounded-lg transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Re-record</span>
              </button>
            </div>
          )}
        </div>

        {/* Right: Output & Transcription */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Verbatim Model Output
            </span>
            {transcription && (
              <button
                type="button"
                onClick={handleCopy}
                className="text-xs text-indigo-600 hover:underline flex items-center gap-1 font-semibold"
              >
                {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                <span>{copied ? 'Copied' : 'Copy Text'}</span>
              </button>
            )}
          </div>

          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 min-h-[140px] text-xs text-slate-800 leading-relaxed font-mono whitespace-pre-wrap flex flex-col justify-between">
            {transcription ? (
              <span>{transcription}</span>
            ) : (
              <span className="text-slate-400 font-sans italic">
                {isTranscribing
                  ? 'Running gemini-3.5-transcribe model...'
                  : 'Your transcribed text will render here once audio is submitted.'}
              </span>
            )}
          </div>

          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={handleTranscribe}
              disabled={isTranscribing || !audioBase64}
              className="flex-1 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors flex items-center justify-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              <span>{isTranscribing ? 'Transcribing...' : 'Transcribe Audio with Gemini'}</span>
            </button>

            {transcription && (
              <button
                type="button"
                onClick={handleClaimBounty}
                disabled={bountyClaimed}
                className="py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-200 text-white rounded-xl text-xs font-semibold transition-colors"
              >
                {bountyClaimed ? 'Bounty Claimed (+$2.20)' : 'Claim $2.20 Bounty'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
