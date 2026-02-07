import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://szlhdfyqgptcavstnuqo.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN6bGhkZnlxZ3B0Y2F2c3RudXFvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA0NDg5MjUsImV4cCI6MjA4NjAyNDkyNX0.4k-BD7mqdDyYafb71zuJjgDchHgu6IQmYKGE17487aQ'  // Real key

export const supabase = createClient(supabaseUrl, supabaseAnonKey)