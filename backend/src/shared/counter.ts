// In-memory map to track counts for various keys
export const counterTracking = new Map<string, number>()

/**
 * Generalized counter function to execute a target function after a specific count.
 * @param key A unique key to track (e.g., a file path or an identifier).
 * @param targetFunction The function to execute when the count is reached.
 * @param requiredCount The number of times the key must be called before executing the targetFunction.
 * @returns A boolean indicating whether the targetFunction was executed.
 */

export const counter = async (
  key: string,
  targetFunction: () => Promise<void> | void,
  requiredCount: number,
): Promise<number> => {
  const currentCount = counterTracking.get(key) || 0
  const updatedCount = currentCount + 1
  counterTracking.set(key, updatedCount)

  // Check if the required count has been reached
  if (updatedCount >= requiredCount) {
    // Execute the target function
    await targetFunction()
    // Reset the count for the key
    counterTracking.delete(key)
    return updatedCount
  }

  return updatedCount
}
