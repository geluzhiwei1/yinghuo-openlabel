/**
 * Utility functions for interacting with localStorage and sessionStorage.
 * Provides type-safe methods for common storage operations.
 */

type StorageType = 'local' | 'session'

const getStorage = (type: StorageType): Storage => {
  return type === 'local' ? localStorage : sessionStorage
}

/**
 * Safely retrieves an item from storage and parses it as JSON.
 * Returns the parsed value or null if the item does not exist or parsing fails.
 */
export const getStorageItem = <T>(key: string, type: StorageType = 'local'): T | null => {
  try {
    const storage = getStorage(type)
    const item = storage.getItem(key)
    return item ? JSON.parse(item) : null
  } catch (error) {
    console.error(`Error parsing storage item "${key}":`, error)
    return null
  }
}

/**
 * Safely sets an item in storage after stringifying it as JSON.
 */
export const setStorageItem = (key: string, value: unknown, type: StorageType = 'local'): void => {
  try {
    const storage = getStorage(type)
    storage.setItem(key, JSON.stringify(value))
  } catch (error) {
    console.error(`Error setting storage item "${key}":`, error)
  }
}

/**
 * Removes an item from storage.
 */
export const removeStorageItem = (key: string, type: StorageType = 'local'): void => {
  const storage = getStorage(type)
  storage.removeItem(key)
}

/**
 * Clears all items from storage.
 */
export const clearStorage = (type: StorageType = 'local'): void => {
  const storage = getStorage(type)
  storage.clear()
}
