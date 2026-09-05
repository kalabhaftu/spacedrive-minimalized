import { useState, memo, useEffect } from "react";
import clsx from "clsx";
import { getIcon, getBeardedIcon } from "@sd/assets/util";
// @ts-expect-error - Vite glob import, resolved at build time
import { beardedIconUrls } from "@sd/assets/svgs/ext/Extras/urls";
import type { File } from "@sd/ts-client";
import { ThumbstripScrubber } from "./ThumbstripScrubber";
import { getFileKindForIcon, getVirtualMetadata, getContentKind } from "@sd/ts-client";
import { useServer } from "../../../contexts/ServerContext";
import { usePlatform } from "../../../contexts/PlatformContext";

interface ThumbProps {
  file: File;
  size?: number;
  className?: string;
  frameClassName?: string; // Custom frame styling (border, radius, bg)
  iconScale?: number; // Scale factor for fallback icon (0-1, default 1)
  squareMode?: boolean; // Whether thumbnail is cropped to square (media view) or maintains aspect ratio
}

function areThumbnailsEnabled(): boolean {
  try {
    const val = localStorage.getItem("sd_show_image_thumbnails");
    return val === null ? true : val === "true";
  } catch {
    return true;
  }
}

// Global cache for thumbnail loaded states (survives component unmount/remount)
const thumbLoadedCache = new Map<string, boolean>();
const thumbErrorCache = new Map<string, boolean>();

export const Thumb = memo(function Thumb({
  file,
  size = 100,
  className,
  frameClassName,
  iconScale = 1,
  squareMode = false,
}: ThumbProps) {
  const cacheKey = `${file.id}-${size}`;
  const { buildSidecarUrl } = useServer();
  const platform = usePlatform();
  const [enabled, setEnabled] = useState(areThumbnailsEnabled);

  useEffect(() => {
    const onSettingChange = () => setEnabled(areThumbnailsEnabled());
    window.addEventListener("sd_thumbnails_setting_changed", onSettingChange);
    return () => window.removeEventListener("sd_thumbnails_setting_changed", onSettingChange);
  }, []);

  const [thumbLoaded, setThumbLoaded] = useState(
    () => thumbLoadedCache.get(cacheKey) || false,
  );
  const [thumbError, setThumbError] = useState(
    () => thumbErrorCache.get(cacheKey) || false,
  );

  // Update cache when state changes
  useEffect(() => {
    if (thumbLoaded) thumbLoadedCache.set(cacheKey, true);
  }, [thumbLoaded, cacheKey]);

  useEffect(() => {
    if (thumbError) thumbErrorCache.set(cacheKey, true);
  }, [thumbError, cacheKey]);

  const iconSize = size * iconScale;

  // Check for virtual file icon override
  const virtualMetadata = getVirtualMetadata(file);
  const iconOverride = virtualMetadata?.iconUrl;

  // Get content kind for icon resolution
  const contentKind = getContentKind(file);
  const kindCapitalized = getFileKindForIcon(file);

  // Check if this is a video with thumbstrip sidecar
  const isVideo = contentKind === "video";
  const hasThumbstrip = file.sidecars?.some((s) => s.kind === "thumbstrip");

  // Get appropriate thumbnail URL from sidecars based on size
  const getThumbnailUrl = (targetSize: number) => {
    if (!enabled) {
      return null;
    }

    // 1. Try sidecar thumbnail if available
    if (file.content_identity?.uuid && file.sidecars && file.sidecars.length > 0) {
      const thumbnails = file.sidecars.filter((s) => s.kind === "thumb");
      if (thumbnails.length > 0) {
        const preferredSize = targetSize <= 400 ? targetSize * 0.6 : targetSize;

        const thumbnail = thumbnails.sort((a, b) => {
          const aSize = parseInt(a.variant.split("x")[0]?.replace(/\D/g, "") || "0");
          const bSize = parseInt(b.variant.split("x")[0]?.replace(/\D/g, "") || "0");
          const aScaleMatch = a.variant.match(/@(\d+)x/);
          const bScaleMatch = b.variant.match(/@(\d+)x/);
          const aScale = aScaleMatch ? parseInt(aScaleMatch[1]) : 1;
          const bScale = bScaleMatch ? parseInt(bScaleMatch[1]) : 1;
          const aPenalty = (aScale - 1) * 100;
          const bPenalty = (bScale - 1) * 100;
          return Math.abs(aSize - preferredSize) + aPenalty - (Math.abs(bSize - preferredSize) + bPenalty);
        })[0];

        const sidecarUrl = buildSidecarUrl(
          file.content_identity.uuid,
          thumbnail.kind,
          thumbnail.variant,
          thumbnail.format,
        );
        if (sidecarUrl) return sidecarUrl;
      }
    }

    // 2. Direct preview fallback for local images
    const isImage =
      contentKind === "image" ||
      (Boolean(file.extension) &&
        /^(jpe?g|png|gif|webp|svg|bmp|ico|avif|heic|tiff)$/i.test(file.extension!)) ||
      (Boolean(file.name) &&
        /\.(jpe?g|png|gif|webp|svg|bmp|ico|avif|heic|tiff)$/i.test(file.name));

    if (isImage && platform.convertFileSrc) {
      const rawFile = file as any;
      let physicalPath =
        rawFile.physical_path ||
        rawFile.path ||
        (typeof rawFile.sd_path === "string" ? rawFile.sd_path : null) ||
        (rawFile.sd_path && 'Physical' in rawFile.sd_path ? rawFile.sd_path.Physical.path : null) ||
        (rawFile.sd_path && 'Local' in rawFile.sd_path ? rawFile.sd_path.Local.path : null);
      if (physicalPath) {
        if (typeof physicalPath === "object" && "path" in physicalPath) {
          physicalPath = physicalPath.path;
        }
        return platform.convertFileSrc(String(physicalPath));
      }
    }

    return null;
  };

  const thumbnailSrc = getThumbnailUrl(size);

  // Use icon override from virtual files (devices, volumes), otherwise use default icon logic
  const icon =
    iconOverride ||
    getIcon(
      kindCapitalized,
      true, // Dark theme
      file.extension,
      file.kind === "Directory",
    );

  // Check if using generic Document icon (not a Spacedrive variant like Document_pdf)
  const genericDocumentIcon = getIcon("Document", true, null, false);
  const isUsingGenericIcon = icon === genericDocumentIcon;

  // Get bearded icon for extension overlay
  const beardedIconName = getBeardedIcon(file.extension, file.name);
  const beardedIconUrl = beardedIconName
    ? beardedIconUrls[beardedIconName]
    : null;

  // Below 60px, show only bearded icon at full size; above, show as overlay at 40%
  const smallIconThreshold = 60;
  const isSmallIcon = size < smallIconThreshold;
  const badgeSize = isSmallIcon ? iconSize : iconSize * 0.4;

  // Only show bearded badge if using generic Document icon (not Spacedrive variants)
  const showBeardedBadge =
    beardedIconUrl &&
    file.kind === "File" &&
    isUsingGenericIcon &&
    (contentKind === "code" ||
      contentKind === "document" ||
      contentKind === "config");

  // Scale border radius with size (8% of size, clamped between 2px and 8px)
  const borderRadius = Math.min(8, Math.max(2, size * 0.08));

  return (
    <div
      className={clsx(
        "relative pointer-events-none flex shrink-0 grow-0 items-center justify-center",
        className,
      )}
      style={{
        width: size,
        height: size,
        minWidth: size,
        minHeight: size,
        maxWidth: size,
        maxHeight: size,
      }}
    >
      {/* Always show icon first (instant), then thumbnail loads over it */}
      {/* Hide document icon if small and showing bearded badge */}
      {!(isSmallIcon && showBeardedBadge) && (
        <img
          src={icon}
          alt=""
          className={clsx(
            "object-contain transition-opacity",
            // Only hide icon if we actually have a thumbnail that loaded
            thumbLoaded && thumbnailSrc && "opacity-0",
          )}
          style={{
            width: iconSize,
            height: iconSize,
            maxWidth: "100%",
            maxHeight: "100%",
          }}
        />
      )}

      {/* Load thumbnail if available */}
      {thumbnailSrc && !thumbError && (
        <img
          src={thumbnailSrc}
          alt={file.name}
          className={clsx(
            "absolute inset-0 m-auto max-h-full max-w-full object-contain transition-opacity",
            // Default frame styling (can be overridden)
            frameClassName || "border border-app-line/50 bg-app-box/30",
            !thumbLoaded && "opacity-0",
          )}
          style={frameClassName ? undefined : { borderRadius: `${borderRadius}px` }}
          onLoad={() => setThumbLoaded(true)}
          onError={() => setThumbError(true)}
        />
      )}

      {/* Bearded icon badge overlay (centered, slightly toward bottom) */}
      {showBeardedBadge && beardedIconUrl && (
        <img
          src={beardedIconUrl}
          alt=""
          className="absolute left-1/2 top-[55%] -translate-x-1/2 -translate-y-1/2"
          style={{
            width: badgeSize,
            height: badgeSize,
          }}
        />
      )}

      {/* Thumbstrip scrubber overlay (for videos with thumbstrips) */}
      {isVideo && hasThumbstrip && thumbLoaded && (
        <ThumbstripScrubber file={file} size={size} squareMode={squareMode} />
      )}
    </div>
  );
});

export function Icon({
  file,
  size = 24,
  className,
}: {
  file: File;
  size?: number;
  className?: string;
}) {
  // Check for virtual file icon override
  const virtualMetadata = getVirtualMetadata(file);
  const iconOverride = virtualMetadata?.iconUrl;

  // Get content kind for icon resolution
  const kindCapitalized = getFileKindForIcon(file);

  // Use icon override from virtual files (devices, volumes), otherwise use default icon logic
  const icon =
    iconOverride ||
    getIcon(
      kindCapitalized,
      true, // Dark theme
      file.extension,
      file.kind === "Directory",
    );

  return (
    <img
      src={icon}
      alt=""
      className={className}
      style={{ width: size, height: size }}
    />
  );
}