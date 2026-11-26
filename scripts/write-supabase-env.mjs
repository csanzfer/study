import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const envPath = resolve(process.cwd(), 'src/environments/environment.ts');
const localEnvPath = resolve(process.cwd(), 'src/environments/environment.local.ts');

const useLocalFile = process.argv.includes('--from-local');
const isProd = process.argv.includes('--prod') || process.env['NODE_ENV'] === 'production';

let supabaseUrl = (process.env['SUPABASE_URL'] ?? '').trim();
let supabaseAnonKey = (process.env['SUPABASE_ANON_KEY'] ?? '').trim();

if (useLocalFile && existsSync(localEnvPath)) {
  const localContent = readFileSync(localEnvPath, 'utf8');
  const urlMatch = localContent.match(/supabaseUrl\s*:\s*['"`]([^'"`]*)['"`]/);
  const keyMatch = localContent.match(/supabaseAnonKey\s*:\s*['"`]([^'"`]*)['"`]/);
  if (urlMatch) supabaseUrl = urlMatch[1].trim();
  if (keyMatch) supabaseAnonKey = keyMatch[1].trim();
}

const content = `export interface AppEnvironment {
  production: boolean;
  supabaseUrl: string;
  supabaseAnonKey: string;
}

export const environment: AppEnvironment = {
  production: ${isProd ? 'true' : 'false'},
  supabaseUrl: ${JSON.stringify(supabaseUrl)},
  supabaseAnonKey: ${JSON.stringify(supabaseAnonKey)},
};
`;

writeFileSync(envPath, content, 'utf8');

if (supabaseUrl && supabaseAnonKey) {
  console.log('[supabase-env] Configured Supabase environment.');
} else {
  console.log('[supabase-env] No Supabase credentials provided; building in local-first mode.');
}
