'use client';

import * as React from 'react';
import Image from 'next/image';
import {
  identifyPlant,
  type IdentifyPlantOutput,
} from '@/ai/flows/identify-plant';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Loader2,
  Upload,
  Camera,
  Leaf,
  Sun,
  Droplets,
  AlertCircle,
  XCircle,
  Heart,
  HeartPulse, // Icon for Health Status
  Sparkles, // Icon for Proposed Actions
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

// Type definition for the plant identification result
// IdentifyPlantOutput now includes healthStatus and proposedActions
type PlantResult = IdentifyPlantOutput;

// LocalStorage key
const FAVORITES_STORAGE_KEY = 'plantIdentifierFavorites';

// Helper function to read file as Data URI
const readFileAsDataURI = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error); // Pass the actual error
    reader.readAsDataURL(file);
  });
};

export default function PlantIdentifier() {
  const [imagePreview, setImagePreview] = React.useState<string | null>(null);
  const [imageDataUri, setImageDataUri] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [result, setResult] = React.useState<PlantResult | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [favourites, setFavourites] = React.useState<PlantResult[]>([]);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const cameraInputRef = React.useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Load favourites from localStorage on initial mount (client-side only)
  React.useEffect(() => {
    try {
      const storedFavourites = localStorage.getItem(FAVORITES_STORAGE_KEY);
      if (storedFavourites) {
        // Ensure stored data matches the potentially updated PlantResult structure
        const parsedFavourites = JSON.parse(storedFavourites) as PlantResult[];
        // Optional: Filter or map if structure changed significantly and needs migration
        setFavourites(parsedFavourites);
      }
    } catch (err) {
      console.error('Error loading favourites from localStorage:', err); // Log error loading favourites
    }
  }, []);

  // Save favourites to localStorage whenever the list changes
  React.useEffect(() => {
    try {
      localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(favourites));
    } catch (err) {
      console.error('Error saving favourites to localStorage:', err); // Log error saving favourites
    }
  }, [favourites]);

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        setError('Please upload a valid image file (e.g., JPG, PNG, WEBP).');
        setImagePreview(null);
        setImageDataUri(null);
        setResult(null);
        return;
      }
      // Clear previous state before processing new file
      setError(null);
      setResult(null);
      setIsLoading(true);
      setImagePreview(null);
      setImageDataUri(null);

      try {
        const dataUri = await readFileAsDataURI(file);
        setImagePreview(dataUri); // Set preview only after successful read
        setImageDataUri(dataUri);
        await identifyPlantAndUpdateState(dataUri); // Proceed with identification
      } catch (err) {
        console.error('Error processing file:', err); // Log file reading error
        // Display a specific error for file processing failure
        setError(`Failed to read image: ${err instanceof Error ? err.message : 'Please try again.'}`);
        setIsLoading(false);
        // Ensure image state is cleared on file read error
        setImagePreview(null);
        setImageDataUri(null);
      } finally {
         // Reset file input to allow re-uploading the same file
        if (event.target) {
            event.target.value = "";
        }
      }
    }
  };

  const identifyPlantAndUpdateState = async (dataUri: string) => {
    // Reset state specific to the result before making the API call
    setResult(null);
    setError(null); // Clear previous errors
    setIsLoading(true); // Set loading state

    try {
      const identificationResult = await identifyPlant({
        photoDataUri: dataUri,
      });

      // Case 1: Successful identification from AI
      if (identificationResult?.plantIdentification) {
        setResult(identificationResult.plantIdentification);
        setError(null); // Explicitly clear error on success
      }
      // Case 2: AI call succeeded but returned null (couldn't identify)
      else {
        setResult(null);
        // Provide a more specific message for identification failure
        setError('Could not identify the plant. It might not be a plant or the image is unclear. Please try a different image.');
        console.warn('AI analysis returned null or no plantIdentification.'); // Log warning
      }
    } catch (err) {
      // Case 3: Error during the AI identification call (network, API key, etc.)
      console.error('AI Identification error:', err); // Log the detailed error object
      // Display a user-friendly message including the error's message if available
      setError(
        `An error occurred during analysis: ${err instanceof Error ? err.message : 'Please check your connection and try again.'}`
      );
      setResult(null); // Ensure result is cleared on error
    } finally {
      setIsLoading(false); // Stop loading indicator regardless of outcome
    }
  };


  const triggerFileUpload = () => {
    fileInputRef.current?.click();
  };

  const triggerCameraUpload = () => {
    cameraInputRef.current?.click();
  };

  const clearImage = () => {
    setImagePreview(null);
    setImageDataUri(null);
    setResult(null);
    setError(null);
    setIsLoading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
    toast({
      title: 'Image Cleared',
      description: 'Ready for a new plant image.',
    });
  };

  const handleToggleFavourite = (plant: PlantResult | null) => {
    if (!plant || !plant.commonName) return;

    const isFavourite = favourites.some(
      (fav) => fav.commonName === plant.commonName
    );

    if (isFavourite) {
      setFavourites((prev) =>
        prev.filter((fav) => fav.commonName !== plant.commonName)
      );
      toast({
        title: 'Removed from Favourites',
        description: `${plant.commonName} removed from your favourites.`,
      });
    } else {
      // Add the full plant result (including health/actions at time of favouriting)
      setFavourites((prev) => [...prev, plant]);
      toast({
        title: 'Added to Favourites',
        description: `${plant.commonName} added to your favourites.`,
        variant: 'default',
      });
    }
  };

  // Check if the current result is a favourite
  const isCurrentResultFavourite = React.useMemo(() => {
    if (!result || !result.commonName) return false;
    return favourites.some((fav) => fav.commonName === result.commonName);
  }, [result, favourites]);

  return (
    <Card className="w-full max-w-2xl shadow-lg rounded-lg overflow-hidden">
      <CardHeader className="bg-primary text-primary-foreground p-4 md:p-6">
        <CardTitle className="text-2xl md:text-3xl font-semibold flex items-center gap-2">
          <Leaf className="h-6 w-6 md:h-8 md:w-8" /> Plant Identifier & Health Check
        </CardTitle>
        <CardDescription className="text-primary-foreground/90 mt-1">
          Upload an image or use your camera to identify a plant, check its health, and get care tips.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-4 md:p-6 space-y-4">
        <div className="space-y-2">
          <Label
            htmlFor="plant-image-upload"
            className="text-base font-medium"
          >
            Plant Image
          </Label>
          <div className="flex flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={triggerFileUpload}
              className="flex-1"
              disabled={isLoading} // Disable while loading
            >
              <Upload className="mr-2" /> Upload Image
            </Button>
            <Button
              variant="outline"
              onClick={triggerCameraUpload}
              className="flex-1"
              disabled={isLoading} // Disable while loading
            >
              <Camera className="mr-2" /> Use Camera
            </Button>
          </div>
          <Input
            id="plant-image-upload"
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            ref={fileInputRef}
            className="hidden"
            disabled={isLoading}
          />
          <Input
            id="plant-camera-capture"
            type="file"
            accept="image/*"
            capture="environment" // Prioritize rear camera
            onChange={handleFileChange}
            ref={cameraInputRef}
            className="hidden"
            disabled={isLoading}
          />
        </div>

        {imagePreview && (
          <div className="relative group mt-4 border border-border rounded-md p-2 bg-secondary/30">
            <Image
              src={imagePreview}
              alt="Uploaded plant preview"
              width={600}
              height={400}
              className="rounded-md object-contain max-h-80 w-full"
              data-ai-hint="plant leaf flower"
            />
             {!isLoading && ( // Only show clear button if not loading
               <Button
                 variant="destructive"
                 size="icon"
                 className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                 onClick={clearImage}
                 aria-label="Clear image"
                 disabled={isLoading} // Disable clear while loading
               >
                 <XCircle className="h-5 w-5" />
               </Button>
             )}
          </div>
        )}

        {isLoading && (
          <div className="flex items-center justify-center space-x-2 text-muted-foreground mt-4">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Analyzing plant...</span>
          </div>
        )}

        {error && !isLoading && ( // Display error only when not loading
          <Alert variant="destructive" className="mt-4">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            {/* Display the detailed error message */}
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Identification Result Card */}
        {result && !isLoading && !error && ( // Display result only on success (no loading, no error)
          <Card className="mt-6 border-primary shadow-md">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div className="flex-1">
                <CardTitle className="text-xl md:text-2xl flex items-center gap-2 flex-wrap">
                  {result.commonName || 'Plant Identified'}
                  <Badge
                    variant={result.isWeed ? 'destructive' : 'secondary'}
                    className="ml-2 whitespace-nowrap"
                  >
                    {result.isWeed ? 'Weed' : 'Not a Weed'}
                  </Badge>
                </CardTitle>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleToggleFavourite(result)}
                aria-label={
                  isCurrentResultFavourite
                    ? 'Remove from Favourites'
                    : 'Add to Favourites'
                }
                className="text-accent hover:text-accent/80"
              >
                <Heart
                  className={`h-6 w-6 ${
                    isCurrentResultFavourite
                      ? 'fill-current text-destructive'
                      : 'stroke-current'
                  }`}
                />
              </Button>
            </CardHeader>
            <CardContent className="space-y-4 text-sm md:text-base pt-4">
              {/* Health Status Section */}
               {result.healthStatus && (
                 <div className="flex items-start gap-3 p-3 bg-secondary/50 rounded-md border border-border">
                   <HeartPulse className="h-5 w-5 text-accent flex-shrink-0 mt-1" />
                   <div>
                     <h4 className="font-medium">Health Status:</h4>
                     <p className="text-muted-foreground">
                       {result.healthStatus}
                     </p>
                   </div>
                 </div>
               )}

               {/* Proposed Actions Section */}
               {result.proposedActions && (
                 <div className="flex items-start gap-3 p-3 bg-secondary/50 rounded-md border border-border">
                   <Sparkles className="h-5 w-5 text-accent flex-shrink-0 mt-1" />
                   <div>
                     <h4 className="font-medium">Proposed Actions:</h4>
                     <p className="text-muted-foreground whitespace-pre-wrap">
                       {result.proposedActions}
                     </p>
                   </div>
                 </div>
               )}

              {/* General Care Instructions Section */}
              <div className="flex items-start gap-3 p-3 bg-secondary/50 rounded-md border border-border">
                <Sun className="h-5 w-5 text-accent flex-shrink-0 mt-1" />
                <div>
                  <h4 className="font-medium">General Care Instructions:</h4>
                  <p className="text-muted-foreground whitespace-pre-wrap">
                    {result.careInstructions ||
                      'No specific care instructions provided.'}
                  </p>
                  {/* Conditionally show water drop icon */}
                  {result.careInstructions
                    ?.toLowerCase()
                    .includes('water') && (
                    <div className="flex items-center gap-1 text-muted-foreground mt-2">
                      <Droplets className="h-4 w-4 text-accent flex-shrink-0" />
                      <span className="text-xs">
                        Remember watering needs.
                      </span>
                    </div>
                  )}
                </div>
              </div>

            </CardContent>
          </Card>
        )}

        {/* Placeholder when no image/result/error */}
        {!imagePreview && !isLoading && !error && !result && (
          <div className="text-center text-muted-foreground py-10 border-2 border-dashed border-border rounded-lg">
            <Leaf className="mx-auto h-12 w-12 mb-2" />
            <p>
              Upload an image or use the camera to start identifying your
              plant!
            </p>
          </div>
        )}

        {/* Display Favourites Section */}
        {favourites.length > 0 && (
          <Card className="mt-6 border-accent">
            <CardHeader>
              <CardTitle className="text-xl md:text-2xl flex items-center gap-2">
                <Heart className="h-6 w-6 text-destructive fill-current" /> Your
                Favourite Plants
              </CardTitle>
            </CardHeader>
            <CardContent>
              {favourites.length === 0 ? (
                 <p className="text-muted-foreground text-center">No favourite plants yet.</p>
              ) : (
                <ul className="space-y-2">
                  {favourites.map((fav, index) => (
                    <li
                      key={`${fav.commonName}-${index}`} // Use index for key stability if names aren't unique enough
                      className="flex justify-between items-center p-2 border-b last:border-b-0 hover:bg-secondary/50 rounded-md transition-colors"
                    >
                      <span className="font-medium">{fav.commonName}</span>
                      {/* Maybe add a small detail like isWeed status? */}
                      {/* <Badge variant={fav.isWeed ? 'destructive' : 'secondary'} className="ml-2 text-xs">{fav.isWeed ? 'Weed' : 'Plant'}</Badge> */}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleToggleFavourite(fav)}
                        aria-label={`Remove ${fav.commonName} from Favourites`}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <XCircle className="h-5 w-5" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        )}
      </CardContent>
      <CardFooter className="p-4 md:p-6 bg-secondary/30 border-t">
         <p className="text-xs text-muted-foreground text-center w-full">
             AI-powered plant analysis. Results may vary. Always consult with a professional for critical plant health issues.
         </p>
      </CardFooter>
    </Card>
  );
}
