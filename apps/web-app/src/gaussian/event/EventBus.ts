import mitt from 'mitt'

export type GaussianEvents = {
  'window:resized': void
  'splat:loaded': { count: number; format: string; fileName: string }
  'splat:cleared': void
  'splat:error': { message: string }
  'selection:changed': { indices: number[] }
  'panel:reload': void
  'request-import': void
  'frame-camera': void
}

export const eventBus = mitt<GaussianEvents>()
