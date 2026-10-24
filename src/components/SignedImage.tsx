import { useEffect, useState } from "react";

import { signedUrl } from "@/lib/storage";
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
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;
    setUrl(null);
    signedUrl(reference).then((value) => {
      if (value?.startsWith("blob:")) objectUrl = value;
      if (active) setUrl(value);
      else if (objectUrl) URL.revokeObjectURL(objectUrl);
    });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [reference]);

  if (!url) {
    return (
      <div className={cn("flex items-center justify-center bg-secondary", className)}>
        {fallback}
      </div>
    );
  }

  return <img src={url} alt={alt} loading="lazy" className={cn("object-cover", className)} />;
}
