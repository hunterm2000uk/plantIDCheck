"use client";

import * as React from "react";
import Image from "next/image";
import { identifyPlant, type IdentifyPlantOutput } from "@/ai/flows/identify-plant";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, Upload, Camera, Leaf, Sun, Droplets, AlertCircle, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// Helper function to read file as Data URI
const readFileAsDataURI = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

export default function PlantIdentifier() {
  const [imagePreview, setImagePreview] = React.useState<string | null>(null);
  const [imageDataUri, setImageDataUri] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [result, setResult] = React.useState<IdentifyPlantOutput["plantIdentification"] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const cameraInputRef = React.useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Basic validation for image types
      if (!file.type.startsWith('image/')) {
        setError("Please upload a valid image file (e.g., JPG, PNG, WEBP).");
        setImagePreview(null);
        setImageDataUri(null);
        setResult(null);
        return;
      }
      // Reset state
      setError(null);
      setResult(null);
      setIsLoading(true); // Show loading immediately

      try {
        const dataUri = await readFileAsDataURI(file);
        setImagePreview(dataUri);
        setImageDataUri(dataUri);
        await identifyPlantAndUpdateState(dataUri);
      } catch (err) {
        console.error("Error processing file:", err);
        setError("Failed to read or process the image.");
        setIsLoading(false);
        setImagePreview(null);
        setImageDataUri(null);
      }
    }
  };

  const identifyPlantAndUpdateState = async (dataUri: string) => {
    try {
      const identificationResult = await identifyPlant({ photoDataUri: dataUri });
      if (identificationResult?.plantIdentification) {
        setResult(identificationResult.plantIdentification);
      } else {
        setError("Could not identify the plant. Please try a clearer image.");
      }
    } catch (err) {
      console.error("AI Identification error:", err);
      setError("An error occurred during plant identification. Please try again.");
      setResult(null); // Clear previous result on error
    } finally {
      setIsLoading(false);
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
    // Reset file input values if they exist
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";
     toast({
        title: "Image Cleared",
        description: "Ready for a new plant image.",
      });
  }

  return (
    <Card className="w-full max-w-2xl shadow-lg rounded-lg overflow-hidden">
      <CardHeader className="bg-primary text-primary-foreground p-4 md:p-6">
        <CardTitle className="text-2xl md:text-3xl font-semibold flex items-center gap-2">
          <Leaf className="h-6 w-6 md:h-8 md:w-8" /> Plant Identifier
        </CardTitle>
        <CardDescription className="text-primary-foreground/90 mt-1">
          Upload an image or use your camera to identify a plant.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-4 md:p-6 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="plant-image-upload" className="text-base font-medium">Plant Image</Label>
          <div className="flex flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={triggerFileUpload} className="flex-1">
              <Upload className="mr-2" /> Upload Image
            </Button>
            <Button variant="outline" onClick={triggerCameraUpload} className="flex-1">
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
          />
           <Input
            id="plant-camera-capture"
            type="file"
            accept="image/*"
            capture="environment" // Prefer back camera
            onChange={handleFileChange}
            ref={cameraInputRef}
            className="hidden"
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
               data-ai-hint="plant leaf"
             />
             <Button
                variant="destructive"
                size="icon"
                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={clearImage}
                aria-label="Clear image"
             >
                <XCircle className="h-5 w-5" />
             </Button>
           </div>
        )}

        {isLoading && (
          <div className="flex items-center justify-center space-x-2 text-muted-foreground mt-4">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Identifying plant...</span>
          </div>
        )}

        {error && (
          <Alert variant="destructive" className="mt-4">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {result && !isLoading && (
          <Card className="mt-6 border-primary shadow-md">
            <CardHeader>
              <CardTitle className="text-xl md:text-2xl flex items-center justify-between">
                {result.commonName || "Plant Identified"}
                <Badge variant={result.isWeed ? "destructive" : "secondary"} className="ml-2">
                  {result.isWeed ? "Weed" : "Not a Weed"}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm md:text-base">
              <div className="flex items-start gap-2">
                <Sun className="h-5 w-5 text-accent flex-shrink-0 mt-1" />
                <div>
                   <h4 className="font-medium">Care Instructions:</h4>
                   <p className="text-muted-foreground whitespace-pre-wrap">{result.careInstructions || "No specific care instructions provided."}</p>
                </div>
              </div>
              {/* Example of adding more icons - could dynamically parse instructions */}
              {result.careInstructions?.toLowerCase().includes("water") && (
                 <div className="flex items-start gap-2">
                   <Droplets className="h-5 w-5 text-accent flex-shrink-0 mt-1" />
                   <p className="text-muted-foreground">Remember to water appropriately.</p>
                 </div>
              )}
            </CardContent>
             {/* Optionally add a footer */}
            {/* <CardFooter className="text-xs text-muted-foreground">
              Identification based on AI analysis. Always consult with a local expert for critical decisions.
            </CardFooter> */}
          </Card>
        )}
         {!imagePreview && !isLoading && !error && !result && (
            <div className="text-center text-muted-foreground py-10 border-2 border-dashed border-border rounded-lg">
                <Leaf className="mx-auto h-12 w-12 mb-2" />
                <p>Upload an image or use the camera to start identifying your plant!</p>
            </div>
        )}

      </CardContent>
    </Card>
  );
}
