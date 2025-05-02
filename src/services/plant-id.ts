/**
 * Represents detailed information about a plant.
 * This interface is kept for potential future use or reference,
 * but is currently not actively used by the identifyPlant flow.
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

// Removed the getPlantInfo function as the AI flow now handles data retrieval directly.
// The AI prompt combines identification, weed classification, health assessment,
// proposed actions, and general care instructions based on the image analysis.
