import { publicImageUrl } from "@/lib/storage";
import { cn } from "@/lib/utils";

export function SignedImage({
  reference,
  alt,
  className,
  fallback,
}: {
  reference: string | null;
  alt: string;
  className?: string;
  fallback?: React.ReactNode;
}) {
  const url = publicImageUrl(reference);

  if (!url) {
    return (
      <div className={cn("flex items-center justify-center bg-secondary", className)}>
        {fallback}
      </div>
    );
  }

  return (
    <img
      src={url}
      alt={alt}
      loading="lazy"
      decoding="async"
      className={cn("object-cover", className)}
    />
  );
}
