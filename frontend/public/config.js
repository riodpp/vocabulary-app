// This file is loaded in production by the Dockerfile
// In development, window.env will be undefined and supabase.js will use process.env
if (typeof window !== 'undefined') {
  window.env = window.env || {};
}