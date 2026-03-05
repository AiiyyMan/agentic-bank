import type { FastifyRequest, FastifyReply } from 'fastify';
import { getSupabase } from '../lib/supabase.js';
import type { UserProfile } from '@agentic-bank/shared';

export interface AuthenticatedRequest extends FastifyRequest {
  userId: string;
  userProfile: UserProfile;
}

export async function authMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    reply.status(401).send({ error: 'Missing authorization header' });
    return;
  }

  const token = authHeader.slice(7);
  const supabase = getSupabase();

  try {
    // Verify JWT with Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      reply.status(401).send({ error: 'Invalid or expired token' });
      return;
    }

    // Look up user profile (includes Griffin account URL)
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      reply.status(404).send({ error: 'User profile not found' });
      return;
    }

    // Attach to request
    (request as AuthenticatedRequest).userId = user.id;
    (request as AuthenticatedRequest).userProfile = profile as UserProfile;
  } catch (err) {
    return reply.status(500).send({ error: 'Authentication failed' });
  }
}
