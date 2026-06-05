/**
 * TensorFlow.js 백엔드 관리
 *
 * 두 가지 모드만 지원:
 * - 'gpu'  : WebGPU (GPU 행렬연산) — CPU는 게임 시뮬레이션 병렬 처리
 * - 'cpu'  : WASM 멀티스레드 (CPU 전 코어 활용) — GPU 없을 때
 *
 * 앱 시작 시 자동 감지 후 최적 모드 선택.
 */
import * as tf from '@tensorflow/tfjs';

export type TFBackend = 'webgpu' | 'webgl' | 'wasm';

export interface BackendOption {
  id: TFBackend;
  label: string;
  sublabel: string;
  icon: string;
  color: string;
}

const coreCount = typeof navigator !== 'undefined' ? (navigator.hardwareConcurrency ?? 4) : 4;

export const BACKEND_OPTIONS: BackendOption[] = [
  {
    id: 'webgpu',
    label: '최신 GPU',
    sublabel: 'WebGPU 신경망 가속 (실험적)',
    icon: '🔥',
    color: 'text-orange-400',
  },
  {
    id: 'webgl',
    label: '표준 GPU',
    sublabel: 'WebGL 가속 (대부분 호환)',
    icon: '🚀',
    color: 'text-yellow-400',
  },
  {
    id: 'wasm',
    label: `CPU ${coreCount}코어`,
    sublabel: `WASM 멀티스레드 (${coreCount}코어 전부 활용)`,
    icon: '⚡',
    color: 'text-blue-400',
  },
];

/** 사용 가능한 백엔드 확인 */
export async function checkBackendAvailability(): Promise<Record<TFBackend, boolean>> {
  const hasWebGPU = typeof navigator !== 'undefined' && 'gpu' in navigator;
  return {
    webgpu: hasWebGPU,
    webgl: true,
    wasm: true,
  };
}

/** 자동으로 최적 백엔드 선택 */
export async function autoSelectBestBackend(): Promise<TFBackend> {
  const avail = await checkBackendAvailability();
  if (avail.webgpu) return 'webgpu';
  return 'webgl'; // GPU 강제 사용을 위해 webgl 우선
}

/** 백엔드 전환 */
export async function setTFBackend(backend: TFBackend): Promise<TFBackend> {
  try {
    if (backend === 'webgpu') {
      await import('@tensorflow/tfjs-backend-webgpu');
    } else if (backend === 'wasm') {
      const wasmModule = await import('@tensorflow/tfjs-backend-wasm');
      wasmModule.setWasmPaths('/wasm/');
      if (typeof (wasmModule as any).setThreadsCount === 'function') {
        (wasmModule as any).setThreadsCount(coreCount);
      }
    }
    // webgl은 tfjs 코어에 기본 포함됨

    await tf.setBackend(backend);
    await tf.ready();

    const actual = tf.getBackend() as TFBackend;
    console.log(`[TFBackend] 전환 완료: ${actual}`);
    return actual;
  } catch (e) {
    console.warn(`[TFBackend] ${backend} 실패 → webgl 폴백:`, e);
    await tf.setBackend('webgl');
    await tf.ready();
    return 'webgl';
  }
}

export function getCurrentBackend(): TFBackend {
  const b = tf.getBackend();
  if (b === 'webgpu') return 'webgpu';
  if (b === 'webgl') return 'webgl';
  return 'wasm';
}

export function getTFMemoryInfo() {
  try { return tf.memory(); } catch { return null; }
}
