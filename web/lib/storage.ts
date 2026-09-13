import { env } from 'cloudflare:workers';
export function database(){if(!env.DB)throw new Error('D1 unavailable');return env.DB}
