'use server';

/**
 * @fileOverview Classifies whether a given plant is a weed and provides care instructions.
 *
 * - classifyWeed - A function that classifies a plant as a weed and provides care instructions.
 * - ClassifyWeedInput - The input type for the classifyWeed function.
 * - ClassifyWeedOutput - The return type for the classifyWeed function.
 */

import {ai} from '@/ai/ai-instance';
import {PlantInfo, getPlantInfo} from '@/services/plant-id';
import {z} from 'genkit';

const ClassifyWeedInputSchema = z.object({
  plantName: z.string().describe('The name of the plant to classify.'),
});
export type ClassifyWeedInput = z.infer<typeof ClassifyWeedInputSchema>;

const ClassifyWeedOutputSchema = z.object({
  isWeed: z.boolean().describe('Whether the plant is considered a weed.'),
  careInstructions: z
    .string()
    .describe('Instructions on how to care for the plant.'),
});
export type ClassifyWeedOutput = z.infer<typeof ClassifyWeedOutputSchema>;

export async function classifyWeed(input: ClassifyWeedInput): Promise<ClassifyWeedOutput> {
  return classifyWeedFlow(input);
}

const classifyWeedPrompt = ai.definePrompt({
  name: 'classifyWeedPrompt',
  input: {
    schema: z.object({
      plantName: z.string().describe('The name of the plant to classify.'),
    }),
  },
  output: {
    schema: z.object({
      isWeed: z.boolean().describe('Whether the plant is considered a weed.'),
      careInstructions: z
        .string()
        .describe('Instructions on how to care for the plant.'),
    }),
  },
  prompt: `You are an expert botanist. Determine if the plant named "{{plantName}}" is a weed. Also provide the care instructions for the plant.
`,
});

const classifyWeedFlow = ai.defineFlow<
  typeof ClassifyWeedInputSchema,
  typeof ClassifyWeedOutputSchema
>(
  {
    name: 'classifyWeedFlow',
    inputSchema: ClassifyWeedInputSchema,
    outputSchema: ClassifyWeedOutputSchema,
  },
  async input => {
    const plantInfo: PlantInfo = await getPlantInfo(input.plantName);
    const {output} = await classifyWeedPrompt({
      plantName: input.plantName,
    });

    return {
      isWeed: plantInfo.isWeed,
      careInstructions: plantInfo.careInstructions,
    };
  }
);
