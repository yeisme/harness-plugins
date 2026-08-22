/**
 * Client-local suggestion source registry.
 *
 * V1 keeps suggestion contributions client-local so other plugins in the same
 * Web bundle can register sources without a DSH Host service. A future host
 * registry/projection can replace this while keeping the same source shape.
 *
 * @module @yeisme/dsh-client-ui-next-step-suggestions/sources
 */

import type { SuggestionSource } from './types.ts'

/** Ordered client-local registry of suggestion sources. */
export class SuggestionSourceRegistry {
  readonly #sources: SuggestionSource[] = []

  /**
   * Register a source.
   *
   * @param source - source to register.
   * @returns A disposer that removes the source.
   */
  registerSource(source: SuggestionSource): () => void {
    this.#sources.push(source)
    return () => {
      const index = this.#sources.indexOf(source)
      if (index >= 0) this.#sources.splice(index, 1)
    }
  }

  /**
   * Snapshot the current sources in registration order.
   *
   * @returns Registered sources.
   */
  list(): readonly SuggestionSource[] {
    return [...this.#sources]
  }
}
