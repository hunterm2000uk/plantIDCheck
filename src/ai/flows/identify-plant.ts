'use server';

/**
 * @fileOverview An AI agent that identifies a plant from an image and provides information about it.
 *
 * - identifyPlant - A function that handles the plant identification process.
 * - IdentifyPlantInput - The input type for the identifyPlant function.
 * - IdentifyPlantOutput - The return type for the identifyPlant function.
 */

import {ai} from '@/ai/ai-instance';
import {getPlantInfo, PlantInfo} from '@/services/plant-id';
import {z} from 'genkit';

const IdentifyPlantInputSchema = z.object({
  photoDataUri: z
    .string()
    .describe(
      "A photo of a plant, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type IdentifyPlantInput = z.infer<typeof IdentifyPlantInputSchema>;

// Updated Output Schema to match component expectations (direct object, not nested)
const IdentifyPlantOutputSchema = z.object({
    commonName: z.string().describe('The common name of the identified plant.'),
    isWeed: z.boolean().describe('Whether the plant is classified as a weed.'),
    careInstructions: z.string().describe('Instructions on how to care for the plant.'),
});
// Output type directly maps to the schema
export type IdentifyPlantOutput = z.infer<typeof IdentifyPlantOutputSchema>;

export async function identifyPlant(input: IdentifyPlantInput): Promise<{plantIdentification: IdentifyPlantOutput | null}> {
  const result = await identifyPlantFlow(input);
  // Wrap the result in the expected structure for consistency, even if slightly redundant now
  return { plantIdentification: result };
}


const plantIdentificationPrompt = ai.definePrompt({
  name: 'plantIdentificationPrompt',
  input: {
    schema: z.object({
      photoDataUri: z
        .string()
        .describe(
          "A photo of a plant, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
        ),
    }),
  },
  output: {
    schema: z.object({
      plantName: z.string().describe('The identified name of the plant.'),
    }),
  },
  prompt: `You are an expert botanist. Please identify the plant in the following image.

  Photo: {{media url=photoDataUri}}
  \n  Respond with just the plant name. If you cannot identify the plant from the image, respond with "Unknown".`,
});

const identifyPlantFlow = ai.defineFlow<
  typeof IdentifyPlantInputSchema,
  // Output schema of the flow itself is now the direct plant info
  typeof IdentifyPlantOutputSchema | null // Allow null if identification fails
>({
  name: 'identifyPlantFlow',
  inputSchema: IdentifyPlantInputSchema,
  // Output schema can be the plant info or null
  outputSchema: IdentifyPlantOutputSchema.nullable(),
},
async input => {
  let plantName: string | undefined;
  try {
    const {output} = await plantIdentificationPrompt(input);
    plantName = output?.plantName;
  } catch (error) {
      console.error("Error during plant identification prompt:", error);
      // Don't throw here, allow fallback or null return
      plantName = "Unknown";
  }


  if (!plantName || plantName.toLowerCase() === 'unknown') {
    console.warn('Could not identify plant or prompt returned Unknown.');
    // Return null according to the updated output schema
    return null;
  }

  try {
      const plantInfo: PlantInfo = await getPlantInfo(plantName);

      // Return the direct plant info object
      return {
        commonName: plantInfo.commonName,
        isWeed: plantInfo.isWeed,
        careInstructions: plantInfo.careInstructions,
      };
  } catch (error) {
      console.error(`Error fetching plant info for ${plantName}:`, error);
      // If getPlantInfo fails, still return null or a default structure
       return {
        commonName: plantName, // Use the identified name as fallback
        isWeed: false, // Default assumption
        careInstructions: "Could not retrieve detailed care instructions.",
      };
  }

});

