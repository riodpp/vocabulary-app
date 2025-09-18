# Vocabulary App Frontend

## Deployment

This project uses two separate Fly.io configurations for development and production:

### Development Deployment
```bash
# Uses fly.toml (vocabulary-app-frontend app)
fly deploy
```

### Production Deployment
```bash
# Uses fly.production.toml (vocabulary-app-frontend-prod app)
fly deploy -c fly.production.toml
```

## Environment Variables

### Development
- Uses `.env.local` (gitignored) for local development
- Variables are embedded at build time via build args

### Production
You have two options for production:

#### Option 1: Build Args (Current Setup)
- Variables passed as build args in `fly.production.toml`
- Variables are embedded at build time
- **Security Note**: Build args are visible in build logs

#### Option 2: Runtime Secrets (Recommended for sensitive data)
- Remove Supabase variables from build args in `fly.production.toml`
- Set secrets using: `fly secrets set REACT_APP_SUPABASE_URL=... REACT_APP_SUPABASE_ANON_KEY=... -c fly.production.toml`
- Variables are injected at runtime via `config.template.js`

## Environment Variable Priority

1. **Development**: `process.env` (from `.env.local` → `.env`)
2. **Production**: `window.env` (from Fly.io secrets)

The `supabase.js` file automatically detects the environment and uses the appropriate source.
