/**
 * Shared types for tabs-related functionality.
 */

export type ListItem = {
  name: string
  path: string
  title: string
  icon?: string
  closable?: boolean
  query?: Record<string, any>
  params?: Record<string, any>
}
