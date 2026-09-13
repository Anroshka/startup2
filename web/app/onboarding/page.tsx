import { getCurrentUser } from '@/lib/supabase/server';
import Onboarding from './onboarding';
export const dynamic='force-dynamic';
export default async function Page(){const user=await getCurrentUser();return <Onboarding signedIn={!!user}/>}
