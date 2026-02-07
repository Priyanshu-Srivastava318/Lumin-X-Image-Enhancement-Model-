import { createClient } from '@supabase/supabase-js'

// Supabase configuration
const supabaseUrl = 'https://szlhdfyqgptcavstnuqo.supabase.co'
const supabaseAnonKey = 'sb_publishable_9Y-eetMa4Cv8zA6Ucjz3cQ_5Vt9-bRF'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)