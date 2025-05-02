'use server';

/**
 * @fileOverview Provides care instructions for a given plant.
 *
 * - provideCareInstructions - A function that retrieves and provides care instructions for a plant.
 * - ProvideCareInstructionsInput - The input type for the provideCareInstructions function.
 * - ProvideCareInstructionsOutput - The return type for the provideCareInstructions function.
 */

import {ai} from '@/ai/ai-instance';
import {z} from 'genkit';
import {getPlantInfo} from '@/services/plant-id';

const ProvideCareInstructionsInputSchema = z.object({
  plantName: z.string().describe('The name of the plant to get care instructions for.'),
});
export type ProvideCareInstructionsInput = z.infer<typeof ProvideCareInstructionsInputSchema>;

const ProvideCareInstructionsOutputSchema = z.object({
  careInstructions: z.string().describe('The care instructions for the plant.'),
  isWeed: z.boolean().describe('Whether the plant is considered a weed.'),
});
export type ProvideCareInstructionsOutput = z.infer<typeof ProvideCareInstructionsOutputSchema>;

export async function provideCareInstructions(input: ProvideCareInstructionsInput): Promise<ProvideCareInstructionsOutput> {
  return provideCareInstructionsFlow(input);
}

const provideCareInstructionsFlow = ai.defineFlow<
  typeof ProvideCareInstructionsInputSchema,
  typeof ProvideCareInstructionsOutputSchema
>(
  {
    name: 'provideCareInstructionsFlow',
    inputSchema: ProvideCareInstructionsInputSchema,
    outputSchema: ProvideCareInstructionsOutputSchema,
  },
  async input => {
    const plantInfo = await getPlantInfo(input.plantName);

    return {
      careInstructions: plantInfo.careInstructions,
      isWeed: plantInfo.isWeed,
    };
  }
);
