import { useState, useEffect, useRef, useCallback, type JSX } from 'react';
import { Volume2, VolumeX, Play, Pause } from 'lucide-react';

const VIDEO_MUTE_KEY = 'Tootega_video_muted';

interface VideoPlayerProps {
  className?: string;
  /**
   * As fontes dos vídeos (URLs públicas do App). O motor NÃO conhece mídia: os vídeos são de cada SaaS
   * (dono, 2026-10-23 — os do ERP moravam aqui, e saíram). Lista vazia ⇒ não renderiza nada, em vez de
   * um <video> com src inexistente.
   */
  sources?: readonly string[];
}

function shuffleArray<T>(arr: T[]): T[] {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Video player with mute/unmute and play/pause buttons with persistent preference.
 * Plays a shuffled playlist of videos, preloading them in background.
 * After completing all videos, reshuffles and repeats.
 */
export function VideoPlayer({ className = '', sources = [] }: VideoPlayerProps): JSX.Element | null {
  // O estado NASCE da preferência gravada, não de `true` fixo.
  //
  // Nascendo sempre mudo, o efeito que persiste `isMuted` rodava na montagem e gravava 'true' por
  // cima da escolha do usuário ANTES de `handleVideoPlay` chegar a lê-la (`userPrefersMuted`) — de
  // modo que quem pediu som o perdia a cada visita, e a preferência não durava nada. Lendo aqui, o
  // primeiro valor JÁ é o certo: o efeito regrava o mesmo conteúdo e não há o que sobrescrever.
  // Sem preferência gravada (primeira visita) o padrão continua sendo mudo — navegador nenhum
  // deixa tocar com som sem gesto do usuário.
  const [isMuted, setIsMuted] = useState(() => {
    const gravado = localStorage.getItem(VIDEO_MUTE_KEY);
    return gravado === null ? true : gravado === 'true';
  });
  const [isPaused, setIsPaused] = useState(false);
  const [playlist, setPlaylist] = useState<string[]>(() => shuffleArray([...sources]));
  const [currentIndex, setCurrentIndex] = useState(0);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const preloadedVideos = useRef<Map<string, HTMLVideoElement>>(new Map());
  const userPrefersMuted = useRef(() => {
    const stored = localStorage.getItem(VIDEO_MUTE_KEY);
    return stored === null ? true : stored === 'true';
  });
  const hasTriedUnmute = useRef(false);
  const hasPreloaded = useRef(false);

  const preloadVideos = useCallback((sources: string[], currentSrc: string) => {
    for (const src of sources) {
      if (src === currentSrc || preloadedVideos.current.has(src))
        continue;
      
      const video = document.createElement('video');
      video.src = src;
      video.preload = 'auto';
      video.muted = true;
      video.load();
      preloadedVideos.current.set(src, video);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(VIDEO_MUTE_KEY, String(isMuted));
  }, [isMuted]);

  useEffect(() => {
    if (hasPreloaded.current)
      return;
    
    hasPreloaded.current = true;
    preloadVideos(playlist, playlist[0]);
  }, [playlist, preloadVideos]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video)
      return;
    
    video.load();
    video.play().catch(() => {});
  }, [playlist, currentIndex]);

  function handleVideoEnded(): void {
    const nextIndex = currentIndex + 1;
    
    if (nextIndex >= playlist.length) {
      const newPlaylist = shuffleArray([...sources]);
      setPlaylist(newPlaylist);
      setCurrentIndex(0);
      hasPreloaded.current = false;
    } else {
      setCurrentIndex(nextIndex);
    }
  }

  async function handleVideoPlay(): Promise<void> {
    const video = videoRef.current;
    if (!video || hasTriedUnmute.current)
      return;

    hasTriedUnmute.current = true;

    const prefersMuted = userPrefersMuted.current();
    if (prefersMuted)
      return;

    try {
      video.muted = false;
      await video.play();
      setIsMuted(false);
    } catch {
      video.muted = true;
      setIsMuted(true);
      video.play().catch(() => {});
    }
  }

  function handleToggleMute(): void {
    const video = videoRef.current;
    if (!video)
      return;

    const newMuted = !isMuted;
    video.muted = newMuted;
    setIsMuted(newMuted);
  }

  function handleTogglePause(): void {
    const video = videoRef.current;
    if (!video)
      return;

    if (video.paused) {
      video.play().catch(() => {});
      setIsPaused(false);
    } else {
      video.pause();
      setIsPaused(true);
    }
  }

  if (playlist.length === 0)
    return null;

  return (
    <div className={`relative ${className}`}>
      <video
        ref={videoRef}
        src={playlist[currentIndex]}
        autoPlay
        muted={isMuted}
        playsInline
        onPlay={handleVideoPlay}
        onEnded={handleVideoEnded}
        className="w-full h-full object-contain"
      />
      <div className="absolute bottom-4 left-4 flex gap-2">
        <button
          type="button"
          onClick={handleToggleMute}
          className="p-2 rounded-lg bg-black/50 hover:bg-black/70 text-white/80 hover:text-white transition-all duration-200"
          title={isMuted ? 'Ativar som' : 'Desativar som'}
        >
          {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
        </button>
        <button
          type="button"
          onClick={handleTogglePause}
          className="p-2 rounded-lg bg-black/50 hover:bg-black/70 text-white/80 hover:text-white transition-all duration-200"
          title={isPaused ? 'Reproduzir' : 'Pausar'}
        >
          {isPaused ? <Play size={20} /> : <Pause size={20} />}
        </button>
      </div>
    </div>
  );
}
