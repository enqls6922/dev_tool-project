import { SpriteForgeApp } from "@/components/SpriteForgeApp";
import { UploadErrorBoundary } from "@/components/UploadErrorBoundary";

export default function Home() {
  return (
    <UploadErrorBoundary>
      <SpriteForgeApp />
    </UploadErrorBoundary>
  );
}
