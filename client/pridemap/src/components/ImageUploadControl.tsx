import { useState } from 'react';

interface ImageUploadControlProps {
  authToken: string;
  /** e.g. `/api/locations/42/image`. Pass null when there's no id yet (create mode). */
  uploadUrl: string | null;
  hasImage: boolean;
  onChange: (hasImage: boolean) => void;
}

const buttonStyle: React.CSSProperties = {
  padding: '0.4rem 0.8rem',
  borderRadius: 8,
  border: '1px solid #444',
  fontWeight: 600,
  background: 'transparent',
  color: 'inherit',
};

export default function ImageUploadControl({ authToken, uploadUrl, hasImage, onChange }: ImageUploadControlProps) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Bumped after every upload so the <img> re-fetches instead of showing a
  // browser-cached copy at the same URL.
  const [cacheBust, setCacheBust] = useState(0);

  if (!uploadUrl) {
    return (
      <div style={{ fontSize: 13, opacity: 0.6 }}>
        Save first, then you can upload a photo here.
      </div>
    );
  }

  async function handleUpload() {
    if (!uploadUrl || !file) return;
    setError(null);
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('image', file);
      const res = await fetch(uploadUrl, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${authToken}` },
        body: formData,
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setError(json?.error ?? `Failed to upload (${res.status})`);
        return;
      }
      setFile(null);
      setCacheBust(n => n + 1);
      onChange(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload');
    } finally {
      setUploading(false);
    }
  }

  async function handleRemove() {
    if (!uploadUrl) return;
    setError(null);
    setDeleting(true);
    try {
      const res = await fetch(uploadUrl, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${authToken}` },
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setError(json?.error ?? `Failed to remove (${res.status})`);
        return;
      }
      onChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div style={{ display: 'grid', gap: '0.5rem' }}>
      {hasImage && (
        <div style={{ display: 'grid', gap: '0.4rem' }}>
          <img
            src={`${uploadUrl}?v=${cacheBust}`}
            alt=""
            style={{ width: '100%', maxHeight: 160, objectFit: 'cover', borderRadius: 8 }}
          />
          <button
            type="button"
            onClick={handleRemove}
            disabled={deleting}
            style={{ ...buttonStyle, border: '1px solid #ff5a5a', color: '#ff5a5a', width: 'fit-content', cursor: deleting ? 'not-allowed' : 'pointer' }}
          >
            {deleting ? 'Removing…' : 'Remove uploaded photo'}
          </button>
        </div>
      )}
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          onChange={e => setFile(e.target.files?.[0] ?? null)}
          style={{ fontSize: 13, maxWidth: '100%' }}
        />
        <button
          type="button"
          onClick={handleUpload}
          disabled={!file || uploading}
          style={{ ...buttonStyle, cursor: (!file || uploading) ? 'not-allowed' : 'pointer' }}
        >
          {uploading ? 'Uploading…' : hasImage ? 'Replace photo' : 'Upload photo'}
        </button>
      </div>
      {error && <div style={{ fontSize: 13, color: '#ff5a5a' }}>{error}</div>}
    </div>
  );
}
