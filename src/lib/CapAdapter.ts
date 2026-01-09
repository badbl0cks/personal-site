import Cap, { type ChallengeData } from "@cap.js/server";
import { db, eq, and, gt, lte, Cap_Challenges, Cap_Tokens } from "astro:db";

const cap = new Cap({
  storage: {
    challenges: {
      store: async (token: string, challengeData: ChallengeData) => {
        const expires = challengeData.expires;
        const data = challengeData.challenge;
        await db
          .insert(Cap_Challenges)
          .values({ token: token, data: data, expires: expires })
          .onConflictDoUpdate({
            target: Cap_Challenges.token,
            set: { data: data, expires: expires },
          });
      },
      read: async (token) => {
        const result = await db
          .select({
            challenge: Cap_Challenges.data,
            expires: Cap_Challenges.expires,
          })
          .from(Cap_Challenges)
          .where(
            and(
              eq(Cap_Challenges.token, token),
              gt(Cap_Challenges.expires, Date.now()),
            ),
          )
          .limit(1);

        const data = result[0] as ChallengeData;

        return result ? data : null;
      },

      delete: async (token) => {
        await db.delete(Cap_Challenges).where(eq(Cap_Challenges.token, token));
      },

      deleteExpired: async () => {
        await db
          .delete(Cap_Challenges)
          .where(lte(Cap_Challenges.expires, Date.now()));
      },
    },
    tokens: {
      store: async (tokenKey, expires) => {
        await db
          .insert(Cap_Tokens)
          .values({ key: tokenKey, expires: expires })
          .onConflictDoUpdate({
            target: Cap_Tokens.key,
            set: { expires: expires },
          });
      },

      get: async (tokenKey) => {
        const result = await db
          .select({ expires: Cap_Tokens.expires })
          .from(Cap_Tokens)
          .where(
            and(
              eq(Cap_Tokens.key, tokenKey),
              gt(Cap_Tokens.expires, Date.now()),
            ),
          )
          .limit(1);

        return result ? result[0].expires : null;
      },

      delete: async (tokenKey) => {
        await db.delete(Cap_Tokens).where(eq(Cap_Tokens.key, tokenKey));
      },

      deleteExpired: async () => {
        await db.delete(Cap_Tokens).where(lte(Cap_Tokens.expires, Date.now()));
      },
    },
  },
});

export default cap;
