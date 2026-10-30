import { useCallback, useEffect, useRef, useState, type JSX } from 'react';

import { Camera, X, Loader2, AlertCircle, Check, RefreshCw, KeyRound } from 'lucide-react';
import { ZIndexManager } from '@core/lib/zIndexManager';
import { isMobile } from '@core/lib';
import type { LoginResponse } from '@core/types';
import { type FaceConfig, FaceCaptureSource, selfEnrollFace, faceLogin } from './faceApi';
import { XCartaoDeModal } from '@core/components/templates/XCartaoDeModal';

type Phase = 'reauth' | 'camera' | 'processing' | 'error';

interface Props {
  mode: 'enroll' | 'login';
  config: FaceConfig;
  onClose: () => void;
  onEnrolled?: () => void;
  onLogin?: (response: LoginResponse) => void;
}

function canvasToBlob(pCanvas: HTMLCanvasElement, pType: string, pQuality: number): Promise<Blob | null> {
  return new Promise(resolve => pCanvas.toBlob(b => resolve(b), pType, pQuality));
}

function delay(pMs: number): Promise<void> {
  return new Promise(resolve => window.setTimeout(resolve, pMs));
}

function captureSource(): number {
  return /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)
    ? FaceCaptureSource.MobileCamera
    : FaceCaptureSource.BrowserWebcam;
}

export function FaceCaptureModal({ mode, config, onClose, onEnrolled, onLogin }: Props): JSX.Element {
  const [z] = useState(() => ZIndexManager.next());

  const videoRef = useRef<HTMLVideoElement>(null);
  const workCanvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [phase, setPhase] = useState<Phase>(mode === 'enroll' ? 'reauth' : 'camera');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState<string | null>(null);

  // Step-up re-auth (enroll only): password + 2FA before recording the face.
  const [password, setPassword] = useState('');
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [otpRequired, setOtpRequired] = useState(false);
  const [reauthError, setReauthError] = useState<string | null>(null);

  // Login liveness challenge (head-turn sequence captured over a window).
  const [liveInstruction, setLiveInstruction] = useState<string | null>(null);
  const [challengeRunning, setChallengeRunning] = useState(false);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks())
        track.stop();
      streamRef.current = null;
    }
  }, []);

  const refreshDevices = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices)
      return;
    try {
      const all = await navigator.mediaDevices.enumerateDevices();
      setDevices(all.filter(d => d.kind === 'videoinput'));
    } catch { /* ignore */ }
  }, []);

  const startCamera = useCallback(async (pDeviceId?: string | null) => {
    setCameraError(null);
    stopCamera();
    // Camera APIs require a secure context — `navigator.mediaDevices` is undefined
    // over plain HTTP (e.g. http://<ip> on the LAN). Fail gracefully instead of crashing.
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError('A câmera exige uma conexão segura (HTTPS).');
      return;
    }
    try {
      // Portrait resolution on mobile so the phone's front camera uses its full
      // (wider) vertical field of view instead of a cropped/zoomed landscape mode.
      const ideal = isMobile()
        ? { width: { ideal: 720 }, height: { ideal: 1280 } }
        : { width: { ideal: 1280 }, height: { ideal: 720 } };
      const constraints: MediaStreamConstraints = {
        video: pDeviceId
          ? { deviceId: { exact: pDeviceId }, ...ideal }
          : { facingMode: 'user', ...ideal },
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        try { await videoRef.current.play(); } catch { /* retried on loadedmetadata */ }
      }
      // Device labels are only populated after permission is granted — list cameras now.
      const all = await navigator.mediaDevices.enumerateDevices();
      setDevices(all.filter(d => d.kind === 'videoinput'));
      const activeId = stream.getVideoTracks()[0]?.getSettings().deviceId ?? null;
      setDeviceId(pDeviceId ?? activeId);
    } catch (err) {
      const name = (err as DOMException)?.name;
      let key = 'Nenhuma câmera encontrada.';
      if (name === 'NotAllowedError' || name === 'SecurityError')
        key = 'Permissão de câmera negada.';
      else if (name === 'NotReadableError' || name === 'TrackStartError' || name === 'AbortError')
        key = 'A câmera está em uso por outro aplicativo.'; // camera held by another app (e.g. OBS)
      setCameraError(key);
      // Still refresh the list so the picker shows whatever the OS now exposes.
      void refreshDevices();
    }
  }, [refreshDevices, stopCamera]);

  useEffect(() => {
    // Enroll starts on the re-auth step; the camera opens only after the password is confirmed.
    if (mode === 'login') void startCamera();
    void refreshDevices();
    navigator.mediaDevices?.addEventListener?.('devicechange', refreshDevices);
    return () => {
      stopCamera();
      navigator.mediaDevices?.removeEventListener?.('devicechange', refreshDevices);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const proceedFromReauth = useCallback(() => {
    if (!password) { setReauthError('Senha inválida.'); return; }
    if (otpRequired && !twoFactorCode.trim()) { setReauthError('Informe o código de verificação.'); return; }
    setReauthError(null);
    setPhase('camera');
    void startCamera();
  }, [password, otpRequired, twoFactorCode, startCamera]);

  const makeThumbnail = useCallback(async (pSource: HTMLCanvasElement): Promise<Blob | null> => {
    const scale = Math.min(1, 160 / pSource.width);
    const tw = Math.max(1, Math.round(pSource.width * scale));
    const th = Math.max(1, Math.round(pSource.height * scale));
    const thumb = document.createElement('canvas');
    thumb.width = tw;
    thumb.height = th;
    const ctx = thumb.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(pSource, 0, 0, tw, th);
    return canvasToBlob(thumb, 'image/jpeg', 0.7);
  }, []);

  const grab = useCallback((pCtx: CanvasRenderingContext2D, pVideo: HTMLVideoElement): Promise<Blob | null> => {
    pCtx.drawImage(pVideo, 0, 0);
    return canvasToBlob(pCtx.canvas, 'image/jpeg', 0.92);
  }, []);

  const handleFailure = useCallback((err: unknown) => {
    const code = (err as Error)?.message;
    if (mode === 'enroll' && (code === 'two_factor_required' || code === 'invalid_two_factor'
      || code === 'invalid_password' || code === 'password_required' || code === 'locked_out')) {
      if (code === 'two_factor_required') { setOtpRequired(true); setReauthError('Informe o código de verificação.'); }
      else if (code === 'invalid_two_factor') { setOtpRequired(true); setReauthError('Código de verificação inválido.'); }
      else if (code === 'locked_out') setReauthError('Conta temporariamente bloqueada. Tente mais tarde.');
      else setReauthError('Senha inválida.');
      setPhase('reauth');
      return;
    }
    // Cada recusa DIZ o que houve — nada de "tente novamente" sem motivo: aqui o usuário só acerta
    // se souber o que a captura não conseguiu (rosto fora do quadro, luz, movimento).
    if (mode === 'enroll') {
      setMessage(`O cadastro do rosto não foi concluído: o servidor recusou as imagens capturadas${code ? ` (${code})` : ''}. Fique de frente para a câmera, com o rosto inteiro no quadro e boa iluminação, e repita a captura.`);
    } else if (code === 'no_motion' || code === 'no_rotation' || code === 'presence' || code === 'no_face') {
      // Liveness failed — guide the user to actually move (prove they're live).
      setMessage('A verificação de presença não passou: a captura não viu um rosto se movendo — só uma imagem parada. Olhe para a câmera e vire a cabeça devagar para os lados, como a orientação pede.');
    } else {
      setMessage('O rosto capturado não corresponde a nenhum cadastro. Confira a iluminação e o enquadramento, ou entre com e-mail e senha.');
    }
    setPhase('error');
  }, [mode]);

  // Head-turn challenge capture — SHARED by enroll and login so the reference (multi-angle) and the
  // login probe span the same poses. Guides front/left/right, capturing frames across the window so
  // the server sees continuous presence + real head ROTATION (a static/flat photo can't comply).
  const runChallenge = useCallback(async (): Promise<{ frames: Blob[]; thumb: Blob | null; video: Blob | null }> => {
    const videoEl = videoRef.current;
    const canvas = workCanvasRef.current;
    if (!videoEl || !canvas || videoEl.videoWidth === 0)
      throw new Error('capture_failed');

    canvas.width = videoEl.videoWidth;
    canvas.height = videoEl.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('capture_failed');

    // TEMP/DEV-ONLY: record the raw camera session for recognition validation. Active only when the
    // server advertises debugCapture; the server keeps the upload only while its dump path is set.
    let recorder: MediaRecorder | null = null;
    const chunks: BlobPart[] = [];
    if (config.debugCapture && streamRef.current && typeof MediaRecorder !== 'undefined') {
      try {
        const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9'
          : MediaRecorder.isTypeSupported('video/webm') ? 'video/webm' : '';
        recorder = mime ? new MediaRecorder(streamRef.current, { mimeType: mime }) : new MediaRecorder(streamRef.current);
        recorder.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
        recorder.start();
      } catch { recorder = null; }
    }

    setMessage(null);
    setChallengeRunning(true);
    const perStep = Math.max(2, Math.min(4, config.requiredFrames || 3));
    const steps = ['front', 'left', 'right'].sort(() => Math.random() - 0.5);
    const frames: Blob[] = [];
    let thumb: Blob | null = null;
    for (const step of steps) {
      setLiveInstruction(`face.login.step.${step}`);
      await delay(800); // time to move the head to the pose
      for (let k = 0; k < perStep; k++) {
        const b = await grab(ctx, videoEl);
        if (b) frames.push(b);
        if (step === 'front' && !thumb) thumb = await makeThumbnail(canvas);
        await delay(320);
      }
    }
    setLiveInstruction(null);
    setChallengeRunning(false);
    if (frames.length === 0) throw new Error('capture_failed');
    if (!thumb) thumb = await makeThumbnail(canvas);

    let videoBlob: Blob | null = null;
    if (recorder && recorder.state !== 'inactive') {
      videoBlob = await new Promise<Blob | null>(resolve => {
        recorder!.onstop = () => resolve(chunks.length ? new Blob(chunks, { type: recorder!.mimeType || 'video/webm' }) : null);
        try { recorder!.stop(); } catch { resolve(null); }
      });
    }
    return { frames, thumb, video: videoBlob };
  }, [config.requiredFrames, config.debugCapture, grab, makeThumbnail]);

  const capture = useCallback(() => {
    void (async () => {
      try {
        const { frames, thumb, video } = await runChallenge();
        setPhase('processing');
        stopCamera();
        if (mode === 'enroll') {
          await selfEnrollFace(frames, thumb, captureSource(), password, otpRequired ? twoFactorCode.trim() : undefined, video);
          onEnrolled?.();
          onClose();
        } else {
          const response = await faceLogin(frames, captureSource(), video);
          onLogin?.(response);
          // Parent navigates away; keep the modal in processing until unmounted.
        }
      } catch (err) {
        setChallengeRunning(false);
        setLiveInstruction(null);
        handleFailure(err);
      }
    })();
  }, [runChallenge, mode, password, otpRequired, twoFactorCode, onClose, onEnrolled, onLogin, stopCamera, handleFailure]);

  const title = mode === 'enroll' ? 'Cadastrar rosto' : 'Entrar com o rosto';
  const subtitle = mode === 'enroll' ? 'Cadastre seu rosto para entrar com reconhecimento facial.' : 'Use o reconhecimento facial para entrar.';
  const instructions = mode === 'enroll' ? 'Olhe para a câmera e mantenha o rosto centralizado.' : 'Olhe para a câmera para continuar.';

  return (
    <div className="absolute inset-0 flex items-center justify-center" style={{ zIndex: z }}>
      {/* Clicar fora não fecha (dono, 2026-10-25): só o botão de fechar/cancelar. */}
      <div className="absolute inset-0 bg-black/40 sm:backdrop-blur-sm" role="presentation" />

      {/* Teto duro de modal: 80% da área, largura e altura (dono, 2026-07-12). */}
      <XCartaoDeModal className="w-full flex flex-col bg-brand-surface
        max-w-[min(540px,80%)] max-h-[80%] rounded-2xl">

        <div className="flex items-center justify-between px-4 py-3 border-b border-brand-border shrink-0">
          <div className="min-w-0">
            <h3 className="font-semibold text-brand-text text-ui whitespace-nowrap">{title}</h3>
            <p className="text-ui-xs text-brand-text-secondary whitespace-nowrap">{subtitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={'Cancelar'}
            title={'Cancelar'}
            className="p-2 rounded-lg hover:bg-brand-hover min-h-[44px] min-w-[44px] flex items-center justify-center transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-auto p-4 space-y-4">
          {phase === 'reauth' && (
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-3 rounded-lg bg-brand-primary/5 border border-brand-primary/15">
                <KeyRound size={18} className="text-brand-primary shrink-0 mt-0.5" />
                <p className="text-ui-sm text-brand-text-secondary">{'Confirme sua identidade para continuar.'}</p>
              </div>
              <div>
                <label className="block text-ui-xs font-medium text-brand-text-secondary mb-1">{'Senha'}</label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') proceedFromReauth(); }}
                  autoComplete="current-password"
                  aria-label={'Senha'}
                  className="w-full px-3 py-2 min-h-[44px] rounded-lg border border-brand-border bg-brand-input text-brand-text text-ui
                    focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary"
                />
              </div>
              {otpRequired && (
                <div>
                  <label className="block text-ui-xs font-medium text-brand-text-secondary mb-1">{'Código de verificação'}</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={twoFactorCode}
                    onChange={e => setTwoFactorCode(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') proceedFromReauth(); }}
                    autoComplete="one-time-code"
                    aria-label={'Código de verificação'}
                    className="w-full px-3 py-2 min-h-[44px] rounded-lg border border-brand-border bg-brand-input text-brand-text text-ui
                      focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary"
                  />
                </div>
              )}
              {reauthError && (
                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-ui-xs">
                  <AlertCircle size={14} className="shrink-0" />
                  {reauthError}
                </div>
              )}
            </div>
          )}

          {(phase === 'camera' || phase === 'processing') && (
            <>
              {/* Square box on mobile = tall face area with only a moderate side-crop of
                  the landscape camera frame (full-portrait crop was too zoomed; matching the
                  landscape aspect was too short). 4/3 on desktop. */}
              <div className="relative w-full aspect-square sm:aspect-[4/3] bg-black rounded-xl overflow-hidden mx-auto">
                {cameraError ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white p-4">
                    <AlertCircle size={44} className="text-red-400" />
                    <p className="text-center text-sm">{cameraError}</p>
                  </div>
                ) : (
                  <>
                    {/* object-cover fills the square (moderate side-crop, no black bars);
                        -scale-x-100 mirrors for a natural selfie. The capture (grab) draws
                        the raw, un-mirrored frame, so the server sees it correctly. */}
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      onLoadedMetadata={e => { void e.currentTarget.play().catch(() => {}); }}
                      className="w-full h-full object-cover -scale-x-100"
                    />
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                      <div className="w-[55%] h-[80%] rounded-[50%] border-2 border-white/70 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
                    </div>
                    <div className="absolute bottom-2 inset-x-0 text-center px-3">
                      <span className={`bg-black/65 text-white rounded ${challengeRunning && liveInstruction ? 'px-3 py-1.5 text-ui font-semibold' : 'px-2 py-1 text-ui-xs'}`}>
                        {challengeRunning && liveInstruction ? liveInstruction : 'Posicione o rosto no centro'}
                      </span>
                    </div>
                  </>
                )}
                {phase === 'processing' && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                    <Loader2 size={40} className="animate-spin text-white" />
                  </div>
                )}
              </div>

              {/* Camera picker + rescan — choose the real webcam (e.g. over OBS Virtual Camera);
                  the refresh button re-scans after the user frees the camera (closes OBS, plugs in). */}
              <div className="flex items-center gap-2">
                {devices.length >= 1 && (
                  <select
                    value={deviceId ?? ''}
                    onChange={e => { setDeviceId(e.target.value); void startCamera(e.target.value); }}
                    aria-label={'Câmera'}
                    className="flex-1 min-w-0 px-3 py-2 min-h-[44px] rounded-lg border border-brand-border bg-brand-input text-brand-text text-ui-sm
                      focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary"
                  >
                    {devices.map((d, i) => (
                      <option key={d.deviceId || i} value={d.deviceId}>
                        {d.label || `${'Câmera'} ${i + 1}`}
                      </option>
                    ))}
                  </select>
                )}
                <button
                  type="button"
                  onClick={() => void startCamera()}
                  aria-label={'Atualizar'}
                  title={'Atualizar'}
                  className={`inline-flex items-center justify-center gap-2 min-h-[44px] rounded-lg border border-brand-border
                    text-brand-text hover:bg-brand-hover transition-colors ${devices.length >= 1 ? 'px-3 shrink-0' : 'flex-1 px-4'}`}
                >
                  <RefreshCw size={18} />
                  {devices.length === 0 && <span className="text-ui-sm">{'Atualizar'}</span>}
                </button>
              </div>

              {cameraError && (
                <p className="text-ui-sm text-amber-600 dark:text-amber-400 text-center">{'Mantenha o rosto bem iluminado'}</p>
              )}

              <p className="text-ui-sm text-brand-text-secondary text-center">{instructions}</p>
            </>
          )}

          {phase === 'error' && (
            <div className="flex flex-col items-center justify-center gap-3 py-8 text-center">
              <AlertCircle size={48} className="text-red-500" />
              <p className="text-brand-text text-ui">{message}</p>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-brand-border shrink-0 flex gap-2">
          {phase === 'reauth' && (
            <button
              type="button"
              onClick={proceedFromReauth}
              disabled={!password || (otpRequired && !twoFactorCode.trim())}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 min-h-[44px] rounded-lg
                bg-brand-primary text-white font-medium hover:bg-brand-primary-hover active:bg-brand-primary-active
                disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <KeyRound size={18} />
              {'Continuar'}
            </button>
          )}
          {phase === 'camera' && !cameraError && (
            <button
              type="button"
              onClick={capture}
              disabled={challengeRunning}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 min-h-[44px] rounded-lg
                bg-brand-primary text-white font-medium hover:bg-brand-primary-hover active:bg-brand-primary-active
                disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              {challengeRunning ? <Loader2 size={18} className="animate-spin" /> : <Camera size={18} />}
              {challengeRunning ? 'Verificando…' : 'Capturar'}
            </button>
          )}
          {phase === 'error' && (
            <button
              type="button"
              onClick={() => { setPhase('camera'); setMessage(null); void startCamera(deviceId); }}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 min-h-[44px] rounded-lg
                bg-brand-primary text-white font-medium hover:bg-brand-primary-hover transition-colors"
            >
              <Camera size={18} />
              {'Repetir'}
            </button>
          )}
          {(phase === 'error' || cameraError) && (
            <button
              type="button"
              onClick={onClose}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 min-h-[44px] rounded-lg
                border border-brand-border text-brand-text font-medium hover:bg-brand-hover transition-colors"
            >
              <Check size={18} />
              {'Confirmar'}
            </button>
          )}
        </div>

        <canvas ref={workCanvasRef} className="hidden" />
      </XCartaoDeModal>
    </div>
  );
}
