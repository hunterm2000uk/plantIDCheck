'use server';

/**
 * @fileOverview An AI agent that identifies a plant from an image, assesses its health,
 * determines if it's a weed, and provides care instructions, proposed actions, botanical details,
 * and information about edible fruit if applicable.
 *
 * - identifyPlant - A function that handles the plant analysis process.
 * - IdentifyPlantInput - The input type for the identifyPlant function.
 * - IdentifyPlantOutput - The return type for the identifyPlant function.
 */

import {ai} from '@/ai/ai-instance';
// Removed getPlantInfo import as it's no longer used.
import {z} from 'genkit';

const IdentifyPlantInputSchema = z.object({
  photoDataUri: z
    .string()
    .describe(
      "A photo of a plant, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type IdentifyPlantInput = z.infer<typeof IdentifyPlantInputSchema>;

// Updated Output Schema to include edible fruit information, latin name, and alternative names
const IdentifyPlantOutputSchema = z.object({
    commonName: z.string().describe('The most common name of the identified plant. Respond with "Unknown" if not identifiable.'),
    latinName: z.string().optional().describe('The scientific (Latin) name of the plant.'),
    alternativeNames: z.array(z.string()).optional().describe('Other common names the plant might be known by.'),
    isWeed: z.boolean().describe('Whether the plant is generally classified as a weed.'),
    careInstructions: z.string().describe('General instructions on how to care for this type of plant.'),
    healthStatus: z.string().describe('An assessment of the plant\'s health based on the image (e.g., Healthy, Needs Water, Diseased, Pest Infestation).'),
    proposedActions: z.string().describe('Specific actions to take based on the visual health assessment to improve the plant\'s condition. Provide actionable advice.'),
    height: z.string().optional().describe('Typical mature height of the plant (e.g., "1-2 ft", "Up to 10m").'),
    spread: z.string().optional().describe('Typical mature spread or width of the plant (e.g., "2-3 ft", "5m wide").'),
    growthRate: z.string().optional().describe('The typical growth rate (e.g., "Slow", "Moderate", "Fast").'),
    floweringInfo: z.string().optional().describe('Information about its flowers, including typical blooming season or months (e.g., "Blooms in spring (March-May) with white flowers", "Insignificant flowers").'),
    pruningInfo: z.string().optional().describe('Basic instructions or tips on how and when to prune the plant.'),
    isEdibleFruit: z.boolean().optional().describe('Whether the plant produces edible fruit.'),
    fruitGrowthSeason: z.string().optional().describe('The season(s) or months when the fruit typically starts to grow (e.g., "Spring", "June-July"). Provide only if isEdibleFruit is true.'),
    fruitCareInstructions: z.string().optional().describe('Specific care instructions focused on ensuring healthy fruit production (e.g., fertilization, pollination, pest control). Provide only if isEdibleFruit is true.'),
    fruitHarvestTime: z.string().optional().describe('The typical time or season(s) when the fruit is ready for harvest (e.g., "Late Summer", "August-September"). Provide only if isEdibleFruit is true.'),
});
// Output type directly maps to the schema
export type IdentifyPlantOutput = z.infer<typeof IdentifyPlantOutputSchema>;

// The wrapper function now returns the full output or null, wrapped in the expected structure.
export async function identifyPlant(input: IdentifyPlantInput): Promise<{plantIdentification: IdentifyPlantOutput | null}> {
  const result = await identifyPlantFlow(input);
  // Return null directly within the structure if the flow returns null
  return { plantIdentification: result };
}


// Renamed prompt and updated input/output/prompt text to include fruit, latin, and alternative name details
const plantAnalysisPrompt = ai.definePrompt({
  name: 'plantAnalysisPrompt',
  input: {
    schema: IdentifyPlantInputSchema, // Input remains the same (image)
  },
  output: {
    schema: IdentifyPlantOutputSchema, // Output now includes all fields
  },
  prompt: `You are an expert botanist and plant pathologist. Analyze the plant in the following image.

  Photo: {{media url=photoDataUri}}

  Based on the image and your knowledge:
  1.  **Identify the plant:** Provide its most common name. If you cannot identify it, respond with "Unknown" for the commonName and skip the other points.
  2.  **Scientific & Alternative Names:** Provide the scientific (Latin) name and a list of any other common names it's known by (alternativeNames). If none, provide null or an empty list for alternativeNames.
  3.  **Classify:** Is this type of plant generally considered a weed?
  4.  **Assess Health:** Evaluate the plant's health based *only* on what you see in the image. Describe its condition (e.g., Healthy, Needs Water, Yellowing Leaves, Possible Pest Damage, Fungal Spots, etc.).
  5.  **Propose Actions:** Suggest specific, actionable steps the user can take *based on your visual health assessment* to improve the plant's condition. If the plant looks healthy, suggest routine care actions.
  6.  **Provide General Care:** Give brief, general care instructions suitable for this type of plant (assuming it's healthy).
  7.  **Botanical Details (Optional):** If readily available, provide the typical mature height, spread, growth rate, basic flowering information (including **typical season/months**, e.g., "Blooms in spring (March-May) with white flowers"), and basic pruning advice. If not readily available, omit these fields or set them to null in the JSON.
  8.  **Edible Fruit:** Determine if this plant produces edible fruit.
      *   If YES (isEdibleFruit: true):
          *   State when the fruit typically starts growing (fruitGrowthSeason, e.g., "Spring", "June-July").
          *   Provide specific care tips to ensure healthy fruit production (fruitCareInstructions).
          *   Indicate when the fruit is usually ready for harvest (fruitHarvestTime, e.g., "Late Summer", "August-September").
      *   If NO (isEdibleFruit: false or omit the field), omit the fruitGrowthSeason, fruitCareInstructions, and fruitHarvestTime fields, or set them explicitly to null.

  Respond *only* with a JSON object matching the output schema. Ensure the JSON is valid.`, // Updated prompt to request fruit, latin, and alternative name details
});

const identifyPlantFlow = ai.defineFlow<
  typeof IdentifyPlantInputSchema,
  typeof IdentifyPlantOutputSchema | null // Allow null if identification fails
>({
  name: 'identifyPlantFlow',
  inputSchema: IdentifyPlantInputSchema,
  outputSchema: IdentifyPlantOutputSchema.nullable(), // Output can be the full plant info or null
},
async input => {
  try {
    const {output} = await plantAnalysisPrompt(input);

    // Check if the prompt returned a valid output and identified the plant
    // Use optional chaining and nullish coalescing for safer access
    const commonName = output?.commonName?.trim().toLowerCase();
    if (!output || !commonName || commonName === 'unknown') {
      console.warn('Could not identify plant or prompt returned "Unknown". Output:', output); // Log the actual output for debugging
      return null; // Return null if identification failed or output is missing/invalid
    }

    // Validate if the output structure matches the schema
    const validation = IdentifyPlantOutputSchema.safeParse(output);
    if (!validation.success) {
        console.error("AI output validation failed:", validation.error.errors); // Log Zod validation errors
        // Attempt to return the potentially partial but identified output anyway if commonName exists
        if(output.commonName && output.commonName !== 'Unknown') {
            console.warn("Returning partial output despite validation failure as commonName is present.");
            // Manually construct a valid partial object based on available fields
            // Ensure boolean, string, and array types are handled correctly, provide defaults if necessary
             const partialOutput: Partial<IdentifyPlantOutput> = {
                commonName: output.commonName,
                latinName: typeof output.latinName === 'string' ? output.latinName : undefined,
                alternativeNames: Array.isArray(output.alternativeNames) ? output.alternativeNames.filter(name => typeof name === 'string') : undefined,
                isWeed: typeof output.isWeed === 'boolean' ? output.isWeed : false,
                careInstructions: typeof output.careInstructions === 'string' ? output.careInstructions : 'Care information unavailable.',
                healthStatus: typeof output.healthStatus === 'string' ? output.healthStatus : 'Health status unavailable.',
                proposedActions: typeof output.proposedActions === 'string' ? output.proposedActions : 'Proposed actions unavailable.',
                // Optional fields, only include if present and valid type
                ...(typeof output.height === 'string' && { height: output.height }),
                ...(typeof output.spread === 'string' && { spread: output.spread }),
                ...(typeof output.growthRate === 'string' && { growthRate: output.growthRate }),
                ...(typeof output.floweringInfo === 'string' && { floweringInfo: output.floweringInfo }),
                ...(typeof output.pruningInfo === 'string' && { pruningInfo: output.pruningInfo }),
                // Fruit fields - only include if isEdibleFruit is explicitly true
                ...(typeof output.isEdibleFruit === 'boolean' && { isEdibleFruit: output.isEdibleFruit }),
                ...(output.isEdibleFruit === true && typeof output.fruitGrowthSeason === 'string' && { fruitGrowthSeason: output.fruitGrowthSeason }),
                ...(output.isEdibleFruit === true && typeof output.fruitCareInstructions === 'string' && { fruitCareInstructions: output.fruitCareInstructions }),
                ...(output.isEdibleFruit === true && typeof output.fruitHarvestTime === 'string' && { fruitHarvestTime: output.fruitHarvestTime }),
            };
            // Re-validate the manually constructed partial object
            const partialValidation = IdentifyPlantOutputSchema.safeParse(partialOutput);
            if (partialValidation.success) {
                 return partialValidation.data;
            } else {
                 // If even the partial construction fails validation, log it and return null
                 console.error("Partial output construction also failed validation:", partialValidation.error.errors);
                 return null;
            }
        }
        return null; // Return null if output doesn't match schema and no valid commonName
    }

    // Return the validated output object from the prompt
    return validation.data;

  } catch (error) {
      // Log the specific error encountered during the AI call
      console.error("Error during plant analysis prompt execution:", error);
      // Consider logging specifics like error.message or error.stack if available
      if (error instanceof Error) {
        console.error("Error details:", error.message, error.stack);
      }
      // Return null in case of any error during the AI call
      return null;
  }
});
