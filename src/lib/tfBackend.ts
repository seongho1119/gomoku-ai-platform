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

export type TFBackend = 'webgpu' | 'wasm';

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
    label: 'GPU + CPU',
    sublabel: 'WebGPU 신경망 + JS CPU 병렬',
    icon: '🔥',
    color: 'text-orange-400',
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
    wasm: true, // 모든 현대 브라우저 지원
  };
}

/**
 * 자동으로 최적 백엔드 선택:
 * WebGPU 가능 → GPU+CPU 모드
 * 불가능       → WASM CPU 멀티스레드 모드
 */
export async function autoSelectBestBackend(): Promise<TFBackend> {
  const avail = await checkBackendAvailability();
  return avail.webgpu ? 'webgpu' : 'wasm';
}

/** 백엔드 전환 */
export async function setTFBackend(backend: TFBackend): Promise<TFBackend> {
  try {
    if (backend === 'webgpu') {
      await import('@tensorflow/tfjs-backend-webgpu');
    } else {
      // WASM — 전체 코어 활용
      const wasmModule = await import('@tensorflow/tfjs-backend-wasm');
      wasmModule.setWasmPaths('/wasm/');
      if (typeof (wasmModule as any).setThreadsCount === 'function') {
        (wasmModule as any).setThreadsCount(coreCount);
      }
    }

    await tf.setBackend(backend);
    await tf.ready();

    const actual = tf.getBackend() as TFBackend;
    console.log(`[TFBackend] 전환 완료: ${actual} (코어: ${coreCount})`);
    return actual;
  } catch (e) {
    console.warn(`[TFBackend] ${backend} 실패 → WASM 폴백:`, e);
    const wasmModule = await import('@tensorflow/tfjs-backend-wasm');
    wasmModule.setWasmPaths('/wasm/');
    await tf.setBackend('wasm');
    await tf.ready();
    return 'wasm';
  }
}

export function getCurrentBackend(): TFBackend {
  const b = tf.getBackend();
  if (b === 'webgpu') return 'webgpu';
  return 'wasm';
}

export function getTFMemoryInfo() {
  try { return tf.memory(); } catch { return null; }
}
