/**
 * Tools/microphone test runner — F23 Phase 1 sub-step 5.
 *
 * Uses MediaRecorder to record ~5 seconds, hands the audio Blob URL back to
 * the UI for playback, and returns a CandidateTestResult once the user
 * confirms (or denies) audible playback.
 *
 * Browser dev (next dev): works directly via `getUserMedia`.
 * Tauri WebView: requires `NSMicrophoneUsageDescription` in Info.plist;
 * without it, `getUserMedia` rejects and we surface the OS error verbatim.
 */
import type { CandidateTestResult } from '../../types';

export interface MicTestPreparation {
  audioUrl: string;
  cleanup: () => void;
  /** Wall-clock ms the recording actually took (≈ requested duration). */
  durationMs: number;
}

export async function recordMicSample(durationMs = 5000): Promise<MicTestPreparation> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    throw new Error('Microphone API not available in this environment.');
  }
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  let recorder: MediaRecorder;
  try {
    recorder = new MediaRecorder(stream);
  } catch (e) {
    stream.getTracks().forEach((t) => t.stop());
    throw e instanceof Error ? e : new Error(String(e));
  }
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };
  const startedAt = performance.now();
  return await new Promise<MicTestPreparation>((resolve, reject) => {
    recorder.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      const blob = new Blob(chunks, { type: chunks[0]?.type ?? 'audio/webm' });
      const audioUrl = URL.createObjectURL(blob);
      resolve({
        audioUrl,
        cleanup: () => URL.revokeObjectURL(audioUrl),
        durationMs: Math.round(performance.now() - startedAt),
      });
    };
    recorder.onerror = (e) => {
      stream.getTracks().forEach((t) => t.stop());
      reject(new Error(`Recorder error: ${String((e as ErrorEvent).message ?? e)}`));
    };
    recorder.start();
    setTimeout(() => {
      if (recorder.state !== 'inactive') recorder.stop();
    }, durationMs);
  });
}

export function finalizeMicTest(userConfirmedAudible: boolean, durationMs: number): CandidateTestResult {
  return {
    ok: userConfirmedAudible,
    durationMs,
    message: userConfirmedAudible
      ? 'User confirmed audible playback.'
      : 'User did not confirm audible playback (microphone test failed).',
  };
}
