import { getCurrentUser } from '@/lib/supabase/server';
import Workspace from './workspace';
export const dynamic='force-dynamic';
export default async function Page(){const user=await getCurrentUser();return <Workspace signedIn={!!user}/>}
