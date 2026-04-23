import { Button } from '@eatme/ui';

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <h1 className="text-4xl font-bold mb-8">EatMe v2</h1>
      <p className="text-muted-foreground mb-4">Owner portal — coming soon</p>
      <Button>Get started</Button>
    </main>
  );
}
