import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables!');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function seedAdmin() {
  console.log('Seeding Admin User: lagado...');
  
  // 1. Sign up the user
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: 'lagado@autoshop.com',
    password: 'magandasiategrabe28',
  });

  if (authError) {
    if (authError.message.includes('User already registered')) {
      console.log('User already exists in auth.users!');
      // Still need to ensure profile exists
      await ensureProfile('lagado@autoshop.com');
    } else {
      console.error('Failed to create auth user:', authError.message);
    }
    return;
  }

  if (authData?.user) {
    console.log('Auth user created successfully! ID:', authData.user.id);
    await createProfile(authData.user.id);
  }
}

async function ensureProfile(email) {
  // Since we don't have the service role key to query users directly,
  // we will just try logging in to get the ID, then check profile.
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password: 'magandasiategrabe28',
  });
  
  if (error) {
    console.error('Could not login to verify profile:', error.message);
    return;
  }
  
  if (data?.user) {
    await createProfile(data.user.id);
  }
}

async function createProfile(userId) {
  console.log('Creating admin profile for ID:', userId);
  
  const { error } = await supabase
    .from('profiles')
    .upsert({
      id: userId,
      role: 'admin',
      full_name: 'Lagado Admin'
    });

  if (error) {
    console.error('Error creating profile:', error.message);
  } else {
    console.log('✅ Admin profile successfully created/verified!');
    console.log('You can now log in using the username "lagado" and your password.');
  }
}

seedAdmin();
