import { supabase } from '@/lib/supabase';

export interface CompanySettings {
  setting_id: string;
  tenant_id: string;
  logo_url: string | null;
  logo_storage_path: string | null;
  company_name: string | null;
  primary_color: string;
  secondary_color: string;
  created_at: string;
  updated_at: string;
}

/**
 * Get company settings for a tenant
 */
export async function getCompanySettings(tenantId: string): Promise<CompanySettings | null> {
  const { data, error } = await supabase
    .rpc('get_or_create_company_settings', { p_tenant_id: tenantId });

  if (error) {
    console.error('Error fetching company settings:', error);
    return null;
  }

  // Handle both array and single object responses
  if (Array.isArray(data)) {
    return data[0] || null;
  }
  return data || null;
}

/**
 * Compress image to target size
 */
async function compressImage(file: File, maxSize: number = 400): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    // Track the blob URL so we can revoke it after loading — otherwise each compress
    // call leaks one blob URL until the page unloads.
    let blobUrl: string | null = null;
    const cleanup = () => {
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
        blobUrl = null;
      }
    };
    img.onload = () => {
      // Calculate new dimensions (maintain aspect ratio, max maxSize)
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > maxSize) {
          height = (height * maxSize) / width;
          width = maxSize;
        }
      } else {
        if (height > maxSize) {
          width = (width * maxSize) / height;
          height = maxSize;
        }
      }

      // Create canvas and compress
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }

      // Use better quality settings
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, width, height);

      // Convert to blob with compression
      canvas.toBlob(
        (blob) => {
          cleanup();
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Failed to compress image'));
          }
        },
        file.type,
        0.9 // 90% quality
      );
    };

    img.onerror = () => {
      cleanup();
      reject(new Error('Failed to load image'));
    };
    blobUrl = URL.createObjectURL(file);
    img.src = blobUrl;
  });
}

/**
 * Upload company logo to Supabase Storage
 */
export async function uploadCompanyLogo(
  tenantId: string,
  file: File
): Promise<{ url: string; path: string } | null> {
  // MIME whitelist — block obvious non-images at the gate. file.type can be
  // spoofed via Content-Type header tampering, but combined with backend Supabase
  // bucket policies + the compressImage step (which decodes the file as an image),
  // a renamed .exe won't make it past the upload.
  const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (!ALLOWED_MIME.includes(file.type)) {
    console.error(`Unsupported logo MIME type: ${file.type}`);
    throw new Error(`รองรับเฉพาะรูปภาพ JPG / PNG / WEBP / GIF เท่านั้น`);
  }

  // Compress image before upload
  let processedFile: File = file;

  if (file.type.startsWith('image/')) {
    try {
      console.log('Compressing image...');
      const compressedBlob = await compressImage(file, 400);

      // Get file extension
      const fileExt = file.name.split('.').pop()?.toLowerCase() || 'png';

      // Create new File with compressed blob
      processedFile = new File(
        [compressedBlob],
        `${tenantId}_${Date.now()}.${fileExt}`,
        { type: file.type }
      );

      console.log(`Compressed: ${file.size} bytes -> ${processedFile.size} bytes`);
    } catch (error) {
      console.error('Error compressing image:', error);
      // Use original file if compression fails
      processedFile = file;
    }
  }

  // Create unique filename (use compressed file name if available)
  const fileExt = processedFile.name.split('.').pop();
  const fileName = `${tenantId}/${Date.now()}.${fileExt}`;

  // Upload to storage
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('company-logos')
    .upload(fileName, processedFile, {
      cacheControl: '3600',
      upsert: true
    });

  if (uploadError) {
    console.error('Error uploading logo:', uploadError);
    return null;
  }

  // Get public URL
  const { data: urlData } = supabase.storage
    .from('company-logos')
    .getPublicUrl(fileName);

  return {
    url: urlData.publicUrl,
    path: fileName
  };
}

/**
 * Update company settings (logo, colors, etc.)
 */
export async function updateCompanyLogo(
  tenantId: string,
  settings: {
    logo_url: string;
    logo_storage_path: string;
  }
): Promise<boolean> {
  const { error } = await supabase
    .from('company_settings')
    .update({
      logo_url: settings.logo_url,
      logo_storage_path: settings.logo_storage_path,
      updated_at: new Date().toISOString()
    })
    .eq('tenant_id', tenantId);

  if (error) {
    console.error('Error updating company settings:', error);
    return false;
  }

  return true;
}

/**
 * Update company branding colors
 */
export async function updateCompanyColors(
  tenantId: string,
  colors: {
    primary_color: string;
    secondary_color: string;
  }
): Promise<boolean> {
  const { error } = await supabase
    .from('company_settings')
    .update(colors)
    .eq('tenant_id', tenantId);

  if (error) {
    console.error('Error updating company colors:', error);
    return false;
  }

  return true;
}

/**
 * Delete company logo
 */
export async function deleteCompanyLogo(tenantId: string): Promise<boolean> {
  // Get current settings to find logo path
  const { data: settings } = await supabase
    .from('company_settings')
    .select('logo_storage_path')
    .eq('tenant_id', tenantId)
    .single();

  if (settings?.logo_storage_path) {
    // Delete from storage
    await supabase.storage
      .from('company-logos')
      .remove([settings.logo_storage_path]);
  }

  // Update settings to remove logo
  const { error } = await supabase
    .from('company_settings')
    .update({
      logo_url: null,
      logo_storage_path: null,
      updated_at: new Date().toISOString()
    })
    .eq('tenant_id', tenantId);

  if (error) {
    console.error('Error deleting company logo:', error);
    return false;
  }

  return true;
}
