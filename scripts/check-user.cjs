const { createClient } = require('../node_modules/@supabase/supabase-js/dist/main/index.js');

const supabaseUrl = 'https://pqnjvcbmnatrtvpqnrdx.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1taW5pb24iLCJyZWYiOiJwcG5qdmNibW5hdHJ0dnBxbnJkeCIsInJvbGUiOiJzZXJ2aWNlX3JvbGUiLCJpYXQiOjE3NjU5ODM2NTEsImV4cCI6MjA4MTU1OTY1MX0.goFYNJymVWd-XO3c-RL-PhfJUPXfCEXs3dA5Y5cP0o';

const supabase = createClient(supabaseUrl, supabaseKey);

(async () => {
  const { data: users, error } = await supabase
    .from('users')
    .select('*')
    .ilike('email', '%somrutai%');

  console.log('Users found:', users?.length || 0);
  console.log(JSON.stringify(users, null, 2));
  if (error) console.log('Error:', error);
})();
