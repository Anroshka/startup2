import { getChatGPTUser } from '@/app/chatgpt-auth';
import Onboarding from './onboarding';
export const dynamic='force-dynamic';
export default async function Page(){const user=await getChatGPTUser();return <Onboarding signedIn={!!user}/>}
