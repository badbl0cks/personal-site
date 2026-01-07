import { defineDb, defineTable, column } from "astro:db";

const Cap_Challenges = defineTable({
  columns: {
    token: column.text({ primaryKey: true }),
    data: column.json(),
    expires: column.number(),
  },
});

const Cap_Tokens = defineTable({
  columns: {
    key: column.text({ primaryKey: true }),
    expires: column.number(),
  },
});

export default defineDb({
  tables: { Cap_Challenges, Cap_Tokens },
});
