/**
 * Represents detailed information about a plant.
 */
export interface PlantInfo {
  /**
   * The common name of the plant.
   */
  commonName: string;
  /**
   * Whether the plant is classified as a weed.
   */
  isWeed: boolean;
  /**
   * Instructions on how to care for the plant.
   */
  careInstructions: string;
}

/**
 * Asynchronously retrieves plant information based on the plant's name.
 *
 * @param plantName The name of the plant to retrieve information for.
 * @returns A promise that resolves to a PlantInfo object containing details about the plant.
 */
export async function getPlantInfo(plantName: string): Promise<PlantInfo> {
  // TODO: Implement this by calling an API.

  return {
    commonName: plantName,
    isWeed: false,
    careInstructions: 'Water regularly and provide sunlight.',
  };
}
