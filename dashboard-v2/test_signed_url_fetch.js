const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ngtjhwswbbivqajtpjvg.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ndGpod3N3YmJpdnFhanRwanZnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTE4MjM2MCwiZXhwIjoyMDg0NzU4MzYwfQ.2TPnOfnAzeWG23Y-VuDKxxzQ9QdbHwrnHdVBhS9hU28';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testFetch() {
  try {
    console.log('1. Uploading dummy file...');
    const buffer = Buffer.from('Hello PDF dummy content');
    const storagePath = `rh-aditivos/test/dummy_test_${Date.now()}.pdf`;
    
    const { error: uploadError } = await supabase.storage
      .from('contracts')
      .upload(storagePath, buffer, { contentType: 'application/pdf', upsert: true });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return;
    }
    console.log('Upload success! path:', storagePath);

    console.log('2. Creating signed URL...');
    const { data, error: signError } = await supabase.storage
      .from('contracts')
      .createSignedUrl(storagePath, 60);

    if (signError) {
      console.error('Sign error:', signError);
      return;
    }

    const signedUrl = data.signedUrl;
    console.log('Signed URL:', signedUrl);

    console.log('3. Fetching signed URL using global fetch...');
    const res = await fetch(signedUrl);
    console.log('Fetch status:', res.status, res.statusText);
    
    if (res.ok) {
      const bytes = await res.arrayBuffer();
      console.log('Successfully fetched bytes. Size:', bytes.byteLength);
    } else {
      const text = await res.text();
      console.error('Fetch failed body:', text);
    }

    // Clean up
    console.log('4. Cleaning up...');
    await supabase.storage.from('contracts').remove([storagePath]);
    console.log('Cleanup done.');

  } catch (err) {
    console.error('Catch error:', err);
  }
}

testFetch();
