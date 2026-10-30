import { useRef, useState, useEffect } from 'react';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  SkipBack,
  SkipForward,
  Settings,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const FALLBACK_VIDEO = 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4';

interface VideoPlayerProps {
  src: string;
  onEnded?: () => void;
  onNext?: () => void;
}

export function VideoPlayer({ src, onEnded, onNext }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [duration, setDuration] = useState(0);
  const [current, setCurrent] = useState(0);
  const [buffering, setBuffering] = useState(true);
  const [showControls, setShowControls] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [activeSrc, setActiveSrc] = useState(src.includes('commondatastorage.googleapis.com') ? FALLBACK_VIDEO : src);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setBuffering(true);
    setPlaying(false);
    setCurrent(0);
    setLoadError(false);
    setActiveSrc(src.includes('commondatastorage.googleapis.com') ? FALLBACK_VIDEO : src);
  }, [src]);

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play().then(() => setPlaying(true)).catch(() => setLoadError(true));
    } else {
      v.pause();
      setPlaying(false);
    }
  };

  const toggleMute = () => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
  };

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const v = videoRef.current;
    if (!v || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    v.currentTime = pct * duration;
    setCurrent(v.currentTime);
  };

  const skip = (seconds: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = Math.max(0, Math.min(duration, v.currentTime + seconds));
  };

  const goFullscreen = () => {
    const c = containerRef.current;
    if (!c) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      c.requestFullscreen();
    }
  };

  const fmtTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const handleMouseMove = () => {
    setShowControls(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      if (playing) setShowControls(false);
    }, 3000);
  };

  const pct = duration > 0 ? (current / duration) * 100 : 0;

  return (
    <div
      ref={containerRef}
      className="group relative aspect-video w-full overflow-hidden rounded-xl bg-black"
      onMouseMove={handleMouseMove}
      onMouseLeave={() => playing && setShowControls(false)}
    >
      <video
        ref={videoRef}
        src={activeSrc}
        controls
        controlsList="nodownload"
        className="h-full w-full"
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime)}
        onWaiting={() => setBuffering(true)}
        onCanPlay={() => setBuffering(false)}
        onError={() => {
          setBuffering(false);
          if (activeSrc !== FALLBACK_VIDEO) setActiveSrc(FALLBACK_VIDEO);
          else setLoadError(true);
        }}
        onPlay={() => {
          setPlaying(true);
          setBuffering(false);
        }}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          onEnded?.();
        }}
        onClick={togglePlay}
      />

      {loadError && (
        <div className="absolute inset-0 grid place-items-center bg-black/80 p-6 text-center text-sm text-white">
          <div>
            <p className="font-medium">This video could not load in the player.</p>
            <a href={activeSrc} target="_blank" rel="noreferrer" className="mt-3 inline-block underline underline-offset-4 hover:text-primary">
              Open video in a new tab
            </a>
          </div>
        </div>
      )}

      {/* Buffering spinner */}
      {buffering && (
        <div className="absolute inset-0 grid place-items-center bg-black/20">
          <Loader2 className="h-10 w-10 animate-spin text-background/80" />
        </div>
      )}

      {/* Center play button when paused */}
      {!playing && !buffering && (
        <button
          onClick={togglePlay}
          className="absolute inset-0 grid place-items-center bg-black/20 transition-opacity"
          aria-label="Play"
        >
          <div className="grid h-16 w-16 place-items-center rounded-full bg-background/90 shadow-xl transition-transform hover:scale-110">
            <Play className="ml-1 h-7 w-7 fill-foreground text-foreground" />
          </div>
        </button>
      )}

      {/* Controls */}
      <div
        className={cn(
          'absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent px-4 pb-3 pt-12 transition-opacity duration-300',
          showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
        )}
      >
        {/* Progress bar */}
        <div
          className="group/seek mb-2 flex h-1.5 cursor-pointer items-center"
          onClick={seek}
        >
          <div className="relative h-full w-full rounded-full bg-white/20">
            <div
              className="absolute h-full rounded-full bg-primary"
              style={{ width: `${pct}%` }}
            />
            <div
              className="absolute h-3 w-3 -translate-x-1/2 rounded-full bg-primary opacity-0 transition-opacity group-hover/seek:opacity-100"
              style={{ left: `${pct}%`, top: '-3px' }}
            />
          </div>
        </div>

        <div className="flex items-center gap-3 text-white">
          <button onClick={togglePlay} className="transition-transform hover:scale-110" aria-label={playing ? 'Pause' : 'Play'}>
            {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
          </button>
          <button onClick={() => skip(-10)} className="transition-transform hover:scale-110" aria-label="Back 10s">
            <SkipBack className="h-4 w-4" />
          </button>
          <button onClick={() => skip(10)} className="transition-transform hover:scale-110" aria-label="Forward 10s">
            <SkipForward className="h-4 w-4" />
          </button>
          <button onClick={toggleMute} className="transition-transform hover:scale-110" aria-label={muted ? 'Unmute' : 'Mute'}>
            {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
          </button>
          <span className="text-xs tabular-nums text-white/80">
            {fmtTime(current)} / {fmtTime(duration)}
          </span>
          <div className="ml-auto flex items-center gap-3">
            {onNext && (
              <button
                onClick={onNext}
                className="flex items-center gap-1 text-xs font-medium text-white/80 transition-colors hover:text-white"
              >
                Next
                <SkipForward className="h-4 w-4" />
              </button>
            )}
            <button className="transition-transform hover:scale-110" aria-label="Settings">
              <Settings className="h-4 w-4" />
            </button>
            <button onClick={goFullscreen} className="transition-transform hover:scale-110" aria-label="Fullscreen">
              <Maximize className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
