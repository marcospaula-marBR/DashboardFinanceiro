/**
 * Pure and browser-safe helpers for Supabase Storage path extraction,
 * avatar image resizing/compression, and orphan cleanup.
 */

const CONTRACTS_SAFE_PREFIXES = [
  'rh-aditivos/',
  'avatars/',
  'insurances/',
  'production/',
  'test/',
];

const AVATAR_CLEANUP_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp'];

export interface OptimizedAvatarResult {
  file: File | Blob;
  contentType: string;
  extension: string;
  wasOptimized: boolean;
}

function sanitizeExtension(filename: string): string {
  const parts = filename.split('.');
  if (parts.length < 2) return '';
  const ext = parts.pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || '';
  return ext;
}

/**
 * Extracts a safe internal Storage object path from a Supabase Storage URL
 * (signed, public, authenticated, or raw) or relative path.
 * Returns null for empty strings, external URLs (e.g. ZapSign/Drive), other buckets, or traversal attempts.
 */
export function extractStoragePathFromUrl(
  urlOrPath: string | null | undefined,
  bucket = 'contracts'
): string | null {
  if (typeof urlOrPath !== 'string') return null;
  const trimmed = urlOrPath.trim();
  if (!trimmed) return null;

  const withoutQueryOrHash = trimmed.split('?')[0].split('#')[0].trim();
  if (!withoutQueryOrHash) return null;

  let candidate: string | null = null;

  if (/^https?:\/\//i.test(withoutQueryOrHash)) {
    try {
      const parsed = new URL(withoutQueryOrHash);
      const escapedBucket = bucket.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const pattern = new RegExp(
        `^/storage/v1/object/(?:(?:sign|public|authenticated)/)?${escapedBucket}/(.+)$`
      );
      const match = parsed.pathname.match(pattern);
      if (!match || !match[1]) return null;
      candidate = match[1];
    } catch {
      return null;
    }
  } else {
    if (withoutQueryOrHash.includes('://')) return null;
    const stripped = withoutQueryOrHash.replace(/^\/+/, '');
    if (!stripped) return null;
    if (bucket === 'contracts') {
      const hasKnownPrefix = CONTRACTS_SAFE_PREFIXES.some((prefix) =>
        stripped.startsWith(prefix)
      );
      if (!hasKnownPrefix) return null;
    }
    candidate = stripped;
  }

  let decoded = candidate;
  try {
    decoded = decodeURIComponent(candidate);
  } catch {
    decoded = candidate;
  }

  if (
    !decoded ||
    decoded.startsWith('/') ||
    decoded.includes('..') ||
    decoded.includes('\\')
  ) {
    return null;
  }

  return decoded;
}

/**
 * Builds deduplicated avatar object paths to remove after a successful avatar upload,
 * always excluding keepPath so the newly uploaded file is never deleted.
 */
export function buildAvatarCleanupPaths(
  folder: 'production' | 'test',
  employeeId: string,
  keepPath: string,
  previousUrl?: string | null
): string[] {
  const candidates = new Set<string>();

  if (employeeId) {
    for (const ext of AVATAR_CLEANUP_EXTENSIONS) {
      candidates.add(`avatars/${folder}/${employeeId}.${ext}`);
    }
  }

  const previousPath = extractStoragePathFromUrl(previousUrl, 'contracts');
  if (previousPath && previousPath.startsWith('avatars/')) {
    candidates.add(previousPath);
  }

  candidates.delete(keepPath);
  return Array.from(candidates);
}

/**
 * Computes proportional target dimensions bounded by maxDimension on the longest side.
 */
export function computeResizedDimensions(
  width: number,
  height: number,
  maxDimension = 512
): { width: number; height: number; resized: boolean } {
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    !Number.isFinite(maxDimension) ||
    width <= 0 ||
    height <= 0 ||
    maxDimension <= 0
  ) {
    return { width: 0, height: 0, resized: false };
  }

  const longest = Math.max(width, height);
  if (longest <= maxDimension) {
    return {
      width: Math.round(width),
      height: Math.round(height),
      resized: false,
    };
  }

  const scale = maxDimension / longest;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
    resized: true,
  };
}

function loadImageElement(objectUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to decode avatar image'));
    img.src = objectUrl;
  });
}

function canvasToJpegBlob(
  canvas: HTMLCanvasElement,
  quality: number
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/jpeg', quality);
  });
}

/**
 * Resizes and compresses an avatar image in the browser before uploading to Storage.
 * Falls back transparently to the original file if running outside the browser or if Canvas fails.
 */
export async function optimizeAvatarImageFile(
  file: File,
  options?: { maxDimension?: number; quality?: number }
): Promise<OptimizedAvatarResult> {
  const fallback: OptimizedAvatarResult = {
    file,
    contentType: file.type || 'image/jpeg',
    extension: sanitizeExtension(file.name) || 'jpg',
    wasOptimized: false,
  };

  if (
    typeof document === 'undefined' ||
    typeof window === 'undefined' ||
    typeof Image === 'undefined' ||
    !file.type?.startsWith('image/') ||
    file.type === 'image/svg+xml'
  ) {
    return fallback;
  }

  const maxDimension = options?.maxDimension ?? 512;
  const quality = options?.quality ?? 0.82;
  let objectUrl: string | null = null;

  try {
    objectUrl = URL.createObjectURL(file);
    const img = await loadImageElement(objectUrl);
    const dims = computeResizedDimensions(
      img.naturalWidth,
      img.naturalHeight,
      maxDimension
    );
    if (dims.width <= 0 || dims.height <= 0) {
      return fallback;
    }

    const canvas = document.createElement('canvas');
    canvas.width = dims.width;
    canvas.height = dims.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return fallback;

    // White background avoids dark/black artifacts when converting transparent PNGs to JPEG
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, dims.width, dims.height);
    ctx.drawImage(img, 0, 0, dims.width, dims.height);

    const blob = await canvasToJpegBlob(canvas, quality);
    if (blob && (blob.size < file.size || dims.resized)) {
      return {
        file: blob,
        contentType: 'image/jpeg',
        extension: 'jpg',
        wasOptimized: true,
      };
    }

    return fallback;
  } catch {
    return fallback;
  } finally {
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
    }
  }
}
