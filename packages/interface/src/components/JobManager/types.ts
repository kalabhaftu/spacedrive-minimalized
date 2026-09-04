import type { JsonValue, ExtendedJobListItem, GenericProgress } from "@sd/ts-client";

// Re-export for backwards compatibility
export type JobListItem = ExtendedJobListItem;
export type { GenericProgress };

export const JOB_STATUS_COLORS = {
  running: "rgb(0, 122, 255)",
  completed: "rgb(52, 199, 89)",
  failed: "rgb(255, 59, 48)",
  paused: "rgb(255, 149, 0)",
  queued: "rgba(255, 255, 255, 0.5)",
  cancelled: "rgb(255, 59, 48)",
} as const;

export const CARD_HEIGHT = 72; // px
export const STATUS_DOT_SIZE = 8; // px
export const PROGRESS_BAR_HEIGHT = 12; // px

/**
 * Extracts a meaningful display name from the job's action context
 */
export function getJobDisplayName(job: JobListItem): string {
  const actionType = job.action_context?.action_type || job.action_type;
  const actionInput = job.action_context?.action_input;

  // Handle location indexing specifically
  if (
    actionType === "locations.add" ||
    actionType === "locations.rescan" ||
    actionType === "indexing.start" ||
    job.name === "indexer"
  ) {
    const context = job.action_context?.context as JsonValue;
    const locationName = extractLocationName(actionInput) || extractLocationName(context);
    if (locationName) {
      return `Indexing "${locationName}"`;
    }
    const path = extractPath(actionInput) || extractPath(context);
    if (path) {
      const folderName = path.split("/").filter(Boolean).pop() || path;
      return `Indexing "${folderName}"`;
    }
    return "Indexing";
  }

  if (job.name === "thumbnail_generation") {
    return "Generating Thumbnails";
  }

  if (actionType) {
    try {
      switch (actionType) {
        case "files.copy": {
          const source = extractSourcePath(actionInput);
          if (source) {
            const fileName = source.split("/").pop() || source;
            return `Copying '${fileName}'`;
          }
          break;
        }
        case "files.move": {
          const source = extractSourcePath(actionInput);
          if (source) {
            const fileName = source.split("/").pop() || source;
            return `Moving '${fileName}'`;
          }
          break;
        }
        case "files.delete": {
          const target = extractTargetPath(actionInput);
          if (target) {
            const fileName = target.split("/").pop() || target;
            return `Deleting '${fileName}'`;
          }
          break;
        }
        case "media.thumbnail":
          return "Generating Thumbnails";
        case "media.extract":
          return "Extracting Media";
        case "volumes.index": {
          const context = job.action_context?.context as Record<string, unknown> | null;
          const volumeName = context?.volume_name;
          if (volumeName && typeof volumeName === "string") {
            return `Indexing ${volumeName}`;
          }
          return "Indexing Volume";
        }
        default: {
          return actionType
            .split(".")
            .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
            .join(" ");
        }
      }
    } catch (error) {
      console.warn("Failed to extract display name from action context:", error);
    }
  }

  return job.name.split("_").map(word =>
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join(" ");
}

/**
 * Gets the subtext to display below the job title
 */
export function getJobSubtext(job: JobListItem): string {
  const actionInput = job.action_context?.action_input;
  const context = job.action_context?.context as JsonValue;
  const path = extractPath(actionInput) || extractPath(context);
  const formattedPath = path ? path.replace(/^\/Users\/[^/]+/, "~") : null;

  switch (job.status) {
    case "running": {
      if (formattedPath) return formattedPath;
      if (job.status_message) return job.status_message;
      if (job.current_path) {
        const pathStr = typeof job.current_path === "string"
          ? job.current_path
          : JSON.stringify(job.current_path);
        return pathStr.replace(/^\/Users\/[^/]+/, "~");
      }
      if (job.current_phase) return job.current_phase;
      return job.progress > 0 ? `${Math.round(job.progress * 100)}%` : "Processing...";
    }
    case "completed":
      return formattedPath ? `Completed • ${formattedPath}` : "Completed";
    case "failed":
      return formattedPath ? `Failed • ${formattedPath}` : "Job failed";
    case "queued":
      return formattedPath || "Waiting to start";
    case "paused":
      return formattedPath ? `Paused • ${formattedPath}` : "Paused";
    case "cancelled":
      return formattedPath ? `Cancelled • ${formattedPath}` : "Cancelled";
    default:
      return formattedPath || "";
  }
}

/**
 * Gets the status badge text (shown on the right side)
 */
export function getStatusBadge(job: JobListItem): string {
  switch (job.status) {
    case "running":
      return `${Math.round(job.progress * 100)}%`;
    case "completed":
      return "Completed";
    case "failed":
      return "Failed";
    case "paused":
      return "Paused";
    case "queued":
      return "Queued";
    case "cancelled":
      return "Cancelled";
    default:
      return "";
  }
}

/**
 * Formats duration in milliseconds to human-readable string
 */
export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}

/**
 * Formats a date to time ago (e.g., "2m ago", "1h ago")
 */
export function timeAgo(date: string | Date | undefined): string {
  if (!date) return "—";

  const now = new Date();
  const past = typeof date === "string" ? new Date(date) : date;

  // Check if date is valid
  if (isNaN(past.getTime())) return "—";

  const diffMs = now.getTime() - past.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 0) return `${diffDays}d ago`;
  if (diffHours > 0) return `${diffHours}h ago`;
  if (diffMinutes > 0) return `${diffMinutes}m ago`;
  return "just now";
}

// Helper functions to extract metadata from JsonValue
function extractLocationName(input: JsonValue): string | null {
  if (typeof input === "object" && input !== null) {
    if ("name" in input && typeof input.name === "string" && input.name.trim().length > 0) {
      return input.name;
    }
  }
  return null;
}

function extractPath(input: JsonValue): string | null {
  if (typeof input === "object" && input !== null && "path" in input) {
    const path = input.path;
    // Handle Physical path: { Physical: { device_slug: "...", path: "..." } }
    if (typeof path === "object" && path !== null && "Physical" in path) {
      const physical = path.Physical;
      if (typeof physical === "object" && physical !== null && "path" in physical) {
        return String(physical.path);
      }
    }
    // Handle Local path: { Local: { path: "..." } }
    if (typeof path === "object" && path !== null && "Local" in path) {
      const local = path.Local;
      if (typeof local === "object" && local !== null && "path" in local) {
        return String(local.path);
      }
    }
    // Handle direct string path
    if (typeof path === "string") {
      return path;
    }
  }
  return null;
}

function extractSourcePath(input: JsonValue): string | null {
  if (typeof input === "object" && input !== null && "source" in input) {
    return String(input.source);
  }
  if (typeof input === "object" && input !== null && "sources" in input) {
    const sources = input.sources;
    if (
      typeof sources === "object" &&
      sources !== null &&
      "paths" in sources &&
      Array.isArray(sources.paths) &&
      sources.paths.length > 0
    ) {
      const firstPath = sources.paths[0];
      if (
        typeof firstPath === "object" &&
        firstPath !== null &&
        "Local" in firstPath
      ) {
        const local = firstPath.Local;
        if (typeof local === "object" && local !== null && "path" in local) {
          return String(local.path);
        }
      }
    }
  }
  return null;
}

function extractTargetPath(input: JsonValue): string | null {
  if (typeof input === "object" && input !== null && "target" in input) {
    return String(input.target);
  }
  if (typeof input === "object" && input !== null && "targets" in input) {
    const targets = input.targets;
    if (
      typeof targets === "object" &&
      targets !== null &&
      "paths" in targets &&
      Array.isArray(targets.paths) &&
      targets.paths.length > 0
    ) {
      return String(targets.paths[0]);
    }
  }
  return null;
}
