'use client';

import * as React from 'react';
import NextImage from 'next/image'; // Use alias to avoid conflict with window.Image
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
import { Separator } from "@/components/ui/separator";
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
  Ruler, // Icon for Height/Spread
  TrendingUp, // Icon for Growth Rate
  Flower2, // Icon for Flowering Info
  Scissors, // Icon for Pruning Info
  Info, // Icon for selecting favourite
  Apple, // Icon for Edible Fruit
  CalendarDays, // Icon for Seasons/Time
  ClipboardCheck, // Icon for Care/Instructions
  Grape, // Icon for Harvest
  BookOpen, // Icon for Latin name
  Tags, // Icon for Alternative Names
  RefreshCw, // Icon for Retry
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

// Type definition for the plant identification result
// Includes all fields from IdentifyPlantOutput
type PlantResult = IdentifyPlantOutput;

// Define a type for the error state
type ErrorState = {
  message: string;
  retryable: boolean;
} | null;

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

// Helper function to resize and compress the image
const resizeImage = (
  file: File,
  maxWidth: number,
  maxHeight: number,
  quality: number
): Promise<string> => {
  return new Promise((resolve, reject) => {
    // Explicitly use window.Image to avoid potential naming conflicts
    const img = new window.Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width *= ratio;
        height *= ratio;
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      // Add null check for context
      if (!ctx) {
         reject(new Error("Could not get 2D context from canvas"));
         return;
      }
      ctx.drawImage(img, 0, 0, width, height);

      try {
        const dataURI = canvas.toDataURL('image/jpeg', quality);
        // Clean up the object URL
        URL.revokeObjectURL(img.src);
        resolve(dataURI);
      } catch (e) {
        // Clean up the object URL even if toDataURL fails
        URL.revokeObjectURL(img.src);
        reject(e);
      }
    };
    img.onerror = (error) => {
      // Clean up the object URL on error
      URL.revokeObjectURL(img.src);
      reject(error); // Use the error object
    };

    // Add try-catch around createObjectURL
    try {
        // Create an object URL for the image file
        img.src = URL.createObjectURL(file);
    } catch (urlError) {
        reject(urlError);
    }
  });
};


export default function PlantIdentifier() {
  const [imagePreview, setImagePreview] = React.useState<string | null>(null);
  const [imageDataUri, setImageDataUri] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [result, setResult] = React.useState<PlantResult | null>(null);
  const [error, setError] = React.useState<ErrorState>(null); // Updated error state type
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
        setError({ message: 'Please upload a valid image file (e.g., JPG, PNG, WEBP).', retryable: false }); // Set non-retryable error
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
        // Try resizing first
        let dataUriToUse: string;
        try {
          dataUriToUse = await resizeImage(file, 800, 600, 0.8);
        } catch (resizeError) {
          console.warn('Image resizing failed, falling back to original:', resizeError);
          // If resizing fails, read the original file directly
          try {
             dataUriToUse = await readFileAsDataURI(file);
          } catch (readError) {
             console.error('Error reading original file:', readError);
             // Set non-retryable error for file read failure
             setError({ message: `Failed to read image: ${readError instanceof Error ? readError.message : 'Please try again.'}`, retryable: false });
             setIsLoading(false);
             setImagePreview(null);
             setImageDataUri(null);
             return; // Exit if both resize and read fail
          }
        }

        setImagePreview(dataUriToUse); // Set preview
        setImageDataUri(dataUriToUse); // Set data URI for AI
        await identifyPlantAndUpdateState(dataUriToUse); // Proceed with identification

      } catch (err) {
        // This catch block might be less likely to be hit now, but kept as a fallback
        console.error('Error processing file:', err); // Log file processing error
        // Display a specific, non-retryable error for file processing failure
        setError({ message: `Failed to process image: ${err instanceof Error ? err.message : 'Please try again.'}`, retryable: false });
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
        // Provide a specific, non-retryable message for identification failure
        setError({ message: 'Could not identify the plant. It might not be a plant or the image is unclear. Please try a different image.', retryable: false });
        console.warn('AI analysis returned null or no plantIdentification.'); // Log warning
      }
    } catch (err) {
      // Case 3: Error during the AI identification call (network, API key, etc.)
      console.error('AI Identification error:', err); // Log the detailed error object
      // Set a retryable error message
      setError({
        message: `An error occurred during analysis: ${err instanceof Error ? err.message : 'Please check your connection and try again.'}`,
        retryable: true, // Mark as retryable
      });
      setResult(null); // Ensure result is cleared on error
    } finally {
      setIsLoading(false); // Stop loading indicator regardless of outcome
    }
  };

  // Function to handle the retry action
  const handleRetry = () => {
    if (imageDataUri) {
      toast({
        title: 'Retrying Analysis',
        description: 'Attempting to analyze the plant image again.',
      });
      identifyPlantAndUpdateState(imageDataUri);
    } else {
        setError({ message: 'Cannot retry without an image.', retryable: false}); // Should not happen if button is shown correctly
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
    setError(null); // Clear error state
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

    // Use a combination of commonName and latinName for better uniqueness, if latinName exists
    const plantId = plant.latinName ? `${plant.commonName}-${plant.latinName}` : plant.commonName;
    const isFavourite = favourites.some((fav) => {
        const favId = fav.latinName ? `${fav.commonName}-${fav.latinName}` : fav.commonName;
        return favId === plantId;
    });


    if (isFavourite) {
      setFavourites((prev) =>
        prev.filter((fav) => {
            const favId = fav.latinName ? `${fav.commonName}-${fav.latinName}` : fav.commonName;
            return favId !== plantId;
        })
      );
      toast({
        title: 'Removed from Favourites',
        description: `${plant.commonName} removed from your favourites.`,
      });
       // If the currently displayed result was the one removed, clear it
       const currentResultId = result?.latinName ? `${result.commonName}-${result.latinName}` : result?.commonName;
      if (currentResultId === plantId) {
        // Don't clear imagePreview or imageDataUri, just the result display
        setResult(null);
      }
    } else {
      // Add the full plant result (including all details at time of favouriting)
      setFavourites((prev) => [...prev, plant]);
      toast({
        title: 'Added to Favourites',
        description: `${plant.commonName} added to your favourites.`,
        variant: 'default',
      });
    }
  };

  // Handler for selecting a favourite plant to view its details
  const handleSelectFavourite = (favPlant: PlantResult) => {
    setResult(favPlant); // Display the selected favourite's details
    setError(null); // Clear any previous error
    setIsLoading(false); // Ensure loading is off
    // Clear the image preview and data URI as we are loading from favourites
    setImagePreview(null);
    setImageDataUri(null);
    // Optional: scroll to the results card?
    // const resultCard = document.getElementById('plant-result-card');
    // resultCard?.scrollIntoView({ behavior: 'smooth' });
    toast({
      title: `Viewing ${favPlant.commonName}`,
      description: 'Displaying saved details for this plant.',
    })
  };


  // Check if the current result is a favourite
  const isCurrentResultFavourite = React.useMemo(() => {
    if (!result || !result.commonName) return false;
    const currentResultId = result.latinName ? `${result.commonName}-${result.latinName}` : result.commonName;
    return favourites.some((fav) => {
         const favId = fav.latinName ? `${fav.commonName}-${fav.latinName}` : fav.commonName;
         return favId === currentResultId;
    });
  }, [result, favourites]);

  return (
    <Card className="w-full max-w-2xl shadow-lg rounded-lg overflow-hidden">
      <CardHeader className="bg-primary text-primary-foreground p-4 md:p-6">
        <CardTitle className="text-2xl md:text-3xl font-semibold flex items-center gap-2">
          <Leaf className="h-6 w-6 md:h-8 md:w-8" /> Plant Identifier & Care Guide
        </CardTitle>
        <CardDescription className="text-primary-foreground/90 mt-1">
          Upload an image or use your camera to identify a plant, check its health, and get detailed care tips. View your saved favourites.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-4 md:p-6 space-y-4">
        <div className="space-y-2">
          <Label
            htmlFor="plant-image-upload"
            className="text-base font-medium"
          >
            Identify New Plant
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
            {/* Use renamed NextImage component */}
            <NextImage
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
            <AlertDescription>{error.message}</AlertDescription>
            {/* Show retry button only if the error is retryable and an image exists */}
            {error.retryable && imageDataUri && (
              <div className="mt-3">
                <Button
                    variant="secondary"
                    onClick={handleRetry}
                    disabled={isLoading} // Disable retry while loading
                    className="w-full sm:w-auto"
                >
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Retry Analysis
                </Button>
              </div>
            )}
          </Alert>
        )}

        {/* Identification Result Card */}
        {result && !isLoading && !error && ( // Display result only on success (no loading, no error)
          <Card id="plant-result-card" className="mt-6 border-primary shadow-md"> {/* Added ID for potential scrolling */}
            <CardHeader className="flex flex-row items-start justify-between pb-2 gap-2">
              <div className="flex-1">
                <CardTitle className="text-xl md:text-2xl flex items-center gap-2 flex-wrap">
                  {result.commonName || 'Plant Identified'}
                   {result.isEdibleFruit === true && (
                     <Badge variant="secondary" className="whitespace-nowrap bg-accent text-accent-foreground">
                       <Apple className="mr-1 h-3 w-3" /> Edible Fruit
                     </Badge>
                   )}
                    <Badge
                      variant={result.isWeed ? 'destructive' : 'secondary'}
                      className="ml-auto whitespace-nowrap md:ml-2" // Move weed badge towards right on smaller screens
                    >
                      {result.isWeed ? 'Weed' : 'Not a Weed'}
                    </Badge>
                </CardTitle>
                 {/* Latin Name - Display if available */}
                 {result.latinName && (
                   <p className="text-sm text-muted-foreground italic flex items-center gap-1 mt-1">
                     <BookOpen className="h-4 w-4 flex-shrink-0" />
                     {result.latinName}
                   </p>
                 )}
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
                className="text-accent hover:text-accent/80 flex-shrink-0" // Prevent button from shrinking
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
                {/* Alternative Names - Display if available */}
               {result.alternativeNames && result.alternativeNames.length > 0 && (
                 <div className="flex items-start gap-3 p-3 bg-secondary/30 rounded-md border border-border">
                     <Tags className="h-5 w-5 text-accent flex-shrink-0 mt-1" />
                     <div>
                       <h4 className="font-medium">Also Known As:</h4>
                       <p className="text-muted-foreground">
                         {result.alternativeNames.join(', ')}
                       </p>
                     </div>
                 </div>
               )}
               {/* Conditionally render separator if alternative names exist */}
               {result.alternativeNames && result.alternativeNames.length > 0 && <Separator className="my-4" />}


              {/* Health and Actions Section */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 {/* Health Status */}
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
                 {/* Proposed Actions */}
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
               </div>

              {/* Conditionally render separator if health/actions exist */}
              {(result.healthStatus || result.proposedActions) && <Separator className="my-4" />}

              {/* Botanical Details Section */}
              <div className="space-y-3">
                 <h4 className="text-lg font-medium mb-2">Botanical Details</h4>
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                   {/* Height & Spread */}
                   {(result.height || result.spread) && (
                     <div className="flex items-start gap-2 p-2 bg-secondary/30 rounded">
                       <Ruler className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                       <div>
                         {result.height && <p><strong>Height:</strong> {result.height}</p>}
                         {result.spread && <p><strong>Spread:</strong> {result.spread}</p>}
                       </div>
                     </div>
                   )}
                   {/* Growth Rate */}
                   {result.growthRate && (
                     <div className="flex items-start gap-2 p-2 bg-secondary/30 rounded">
                       <TrendingUp className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                       <p><strong>Growth Rate:</strong> {result.growthRate}</p>
                     </div>
                   )}
                 </div>
                 {/* Flowering Info */}
                 {result.floweringInfo && (
                    <div className="flex items-start gap-3 p-3 bg-secondary/30 rounded-md border border-border">
                       <Flower2 className="h-5 w-5 text-accent flex-shrink-0 mt-1" />
                       <div>
                         <h5 className="font-medium">Flowering:</h5>
                         <p className="text-muted-foreground">{result.floweringInfo}</p>
                       </div>
                    </div>
                 )}
                 {/* Pruning Info */}
                 {result.pruningInfo && (
                    <div className="flex items-start gap-3 p-3 bg-secondary/30 rounded-md border border-border">
                       <Scissors className="h-5 w-5 text-accent flex-shrink-0 mt-1" />
                       <div>
                         <h5 className="font-medium">Pruning:</h5>
                         <p className="text-muted-foreground whitespace-pre-wrap">{result.pruningInfo}</p>
                       </div>
                    </div>
                 )}
              </div>

               {/* Conditionally render separator if botanical details exist */}
              {(result.height || result.spread || result.growthRate || result.floweringInfo || result.pruningInfo) && <Separator className="my-4" />}


              {/* Edible Fruit Section - Conditionally Rendered */}
              {result.isEdibleFruit === true && (
                  <div className="space-y-3">
                    <h4 className="text-lg font-medium mb-2 flex items-center gap-2">
                        <Apple className="h-5 w-5 text-accent" /> Edible Fruit Information
                    </h4>
                    {result.fruitGrowthSeason && (
                        <div className="flex items-start gap-3 p-3 bg-secondary/30 rounded-md border border-border">
                            <CalendarDays className="h-5 w-5 text-accent flex-shrink-0 mt-1" />
                            <div>
                                <h5 className="font-medium">Fruit Growth Season:</h5>
                                <p className="text-muted-foreground">{result.fruitGrowthSeason}</p>
                            </div>
                        </div>
                    )}
                    {result.fruitCareInstructions && (
                        <div className="flex items-start gap-3 p-3 bg-secondary/30 rounded-md border border-border">
                            <ClipboardCheck className="h-5 w-5 text-accent flex-shrink-0 mt-1" />
                            <div>
                                <h5 className="font-medium">Fruit Care:</h5>
                                <p className="text-muted-foreground whitespace-pre-wrap">{result.fruitCareInstructions}</p>
                            </div>
                        </div>
                    )}
                    {result.fruitHarvestTime && (
                        <div className="flex items-start gap-3 p-3 bg-secondary/30 rounded-md border border-border">
                            <Grape className="h-5 w-5 text-accent flex-shrink-0 mt-1" />
                            <div>
                                <h5 className="font-medium">Harvest Time:</h5>
                                <p className="text-muted-foreground">{result.fruitHarvestTime}</p>
                            </div>
                        </div>
                    )}
                     <Separator className="my-4" /> {/* Separator after fruit section */}
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
              plant! You can also view details for your favourite plants below.
            </p>
          </div>
        )}

        {/* Display Favourites Section */}
        {/* Always render the Favourites card, but conditionally show content */}
          <Card className="mt-6 border-accent">
            <CardHeader>
              <CardTitle className="text-xl md:text-2xl flex items-center gap-2">
                <Heart className="h-6 w-6 text-destructive fill-current" /> Your
                Favourite Plants
              </CardTitle>
            </CardHeader>
            <CardContent>
              {favourites.length === 0 ? (
                 <p className="text-muted-foreground text-center">No favourite plants yet. Add some using the heart icon after identifying a plant.</p>
              ) : (
                <ul className="space-y-2">
                  {favourites.map((fav, index) => {
                     // Generate a stable key using commonName and potentially latinName
                     const favKey = fav.latinName ? `${fav.commonName}-${fav.latinName}-${index}` : `${fav.commonName}-${index}`;
                     return (
                        <li
                          key={favKey}
                          className="flex justify-between items-center p-2 border-b last:border-b-0 hover:bg-secondary/50 rounded-md transition-colors group" // Added group class
                        >
                          <div className="flex flex-col">
                             <span className="font-medium">{fav.commonName}</span>
                             {fav.latinName && <span className="text-xs text-muted-foreground italic">{fav.latinName}</span>}
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                             <Button
                               variant="ghost"
                               size="icon"
                               onClick={() => handleSelectFavourite(fav)} // Use new handler
                               aria-label={`View details for ${fav.commonName}`}
                               className="text-muted-foreground hover:text-primary"
                             >
                               <Info className="h-5 w-5" />
                             </Button>
                             <Button
                               variant="ghost"
                               size="icon"
                               onClick={() => handleToggleFavourite(fav)}
                               aria-label={`Remove ${fav.commonName} from Favourites`}
                               className="text-muted-foreground hover:text-destructive"
                             >
                               <XCircle className="h-5 w-5" />
                             </Button>
                          </div>
                        </li>
                     );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>

      </CardContent>
      <CardFooter className="p-4 md:p-6 bg-secondary/30 border-t">
         <p className="text-xs text-muted-foreground text-center w-full">
             AI-powered plant analysis. Results may vary. Always consult with a professional for critical plant health issues.
         </p>
      </CardFooter>
    </Card>
  );
}
