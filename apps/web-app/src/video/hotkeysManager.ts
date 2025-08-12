import { HotkeysManager } from "@/libs/hotkeys-manager"

/**
 * global within video
 * @type {HotkeysManager}
 */
export const hotkeysManager = new HotkeysManager(false)
export const hotkeysManagerAutoOff = new HotkeysManager(true)