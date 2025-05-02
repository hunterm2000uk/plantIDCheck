import PlantIdentifier from '@/components/plant-identifier';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 md:p-8 lg:p-12 bg-background">
      <PlantIdentifier />
    </main>
  );
}
