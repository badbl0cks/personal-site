import Cap, { type ChallengeData } from "@cap.js/server";
import type { AstroSession } from "astro";

export function createCap(session: AstroSession<any> | null) {
  if (!session) {
    throw new Error("Session context is required");
  }
  return new Cap({
    storage: {
      challenges: {
        store: async (token: string, challengeData: ChallengeData) => {
          session.set(`cap:challenge:${token}`, JSON.stringify(challengeData));
        },
        read: async (token: string) => {
          const raw = await session.get(`cap:challenge:${token}`);
          return raw ? (JSON.parse(raw) as ChallengeData) : null;
        },
        delete: async (token: string) => {
          session.delete(`cap:challenge:${token}`);
        },
        deleteExpired: async () => {
          // no-op: session store handles TTL itself
        },
      },
      tokens: {
        store: async (tokenKey: string, expires: number) => {
          session.set(`cap:token:${tokenKey}`, String(expires));
        },
        get: async (tokenKey: string) => {
          const raw = await session.get(`cap:token:${tokenKey}`);
          return raw ? Number(raw) : null;
        },
        delete: async (tokenKey: string) => {
          session.delete(`cap:token:${tokenKey}`);
        },
        deleteExpired: async () => {
          // no-op: session store handles TTL itself
        },
      },
    },
  });
}
