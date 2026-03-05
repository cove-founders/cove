import { getDb } from "../index";
import type { ConversationSummary } from "../types";

export interface SummarySearchResult {
  conversation_id: string;
  summary: string;
  keywords: string | null;
  created_at: string;
  rank: number;
}

/** Normalize query for FTS5 MATCH: escape quotes, collapse whitespace. */
function normalizeFtsQuery(query: string): string {
  const q = query.trim();
  if (!q) return "";
  return q.replace(/"/g, '""').split(/\s+/).filter(Boolean).join(" ");
}

type Db = Awaited<ReturnType<typeof getDb>>;

/** LIKE fallback for summaries — handles CJK and other non-space-delimited text. */
async function likeFallbackSummaries(
  db: Db, query: string, limit: number,
): Promise<SummarySearchResult[]> {
  const keywords = query.trim().split(/\s+/).filter(Boolean);
  if (keywords.length === 0) return [];
  const conditions: string[] = [];
  const params: (string | number)[] = [];
  for (const kw of keywords) {
    const idx = params.length;
    conditions.push(`(s.summary LIKE $${idx + 1} OR s.keywords LIKE $${idx + 2})`);
    params.push(`%${kw}%`, `%${kw}%`);
  }
  params.push(limit);
  return db.select<SummarySearchResult[]>(
    `SELECT s.conversation_id, s.summary, s.keywords, 0.0 as rank,
            s.created_at
     FROM conversation_summaries s
     WHERE ${conditions.join(" OR ")}
     ORDER BY s.created_at DESC
     LIMIT $${params.length}`,
    params,
  );
}

/** LIKE fallback for messages — handles CJK text. */
async function likeFallbackMessages(
  db: Db, query: string, conversationId: string | undefined, limit: number,
): Promise<{ conversation_id: string; message_id: string; body: string }[]> {
  const keywords = query.trim().split(/\s+/).filter(Boolean);
  if (keywords.length === 0) return [];
  const conditions: string[] = [];
  const params: (string | number)[] = [];
  for (const kw of keywords) {
    params.push(`%${kw}%`);
    conditions.push(`m.content LIKE $${params.length}`);
  }
  if (conversationId) {
    params.push(conversationId);
    const convIdx = params.length;
    params.push(limit);
    return db.select(
      `SELECT m.conversation_id, m.id as message_id, COALESCE(m.content, '') as body
       FROM messages m
       WHERE (${conditions.join(" OR ")}) AND m.conversation_id = $${convIdx}
       ORDER BY m.created_at DESC
       LIMIT $${params.length}`,
      params,
    );
  }
  params.push(limit);
  return db.select(
    `SELECT m.conversation_id, m.id as message_id, COALESCE(m.content, '') as body
     FROM messages m
     WHERE ${conditions.join(" OR ")}
     ORDER BY m.created_at DESC
     LIMIT $${params.length}`,
    params,
  );
}

export const summaryRepo = {
  async create(
    id: string,
    conversationId: string,
    summary: string,
    keywords?: string,
  ): Promise<void> {
    const db = await getDb();
    await db.execute(
      `INSERT OR REPLACE INTO conversation_summaries (id, conversation_id, summary, keywords)
       VALUES ($1, $2, $3, $4)`,
      [id, conversationId, summary, keywords ?? null],
    );
    // Sync FTS: delete stale entry then insert fresh
    await db.execute(
      "DELETE FROM conversation_summaries_fts WHERE conversation_id = $1",
      [conversationId],
    );
    await db.execute(
      `INSERT INTO conversation_summaries_fts (summary, keywords, conversation_id)
       VALUES ($1, $2, $3)`,
      [summary, keywords ?? "", conversationId],
    );
  },

  async getByConversation(
    conversationId: string,
  ): Promise<ConversationSummary | undefined> {
    const db = await getDb();
    const rows: ConversationSummary[] = await db.select(
      "SELECT * FROM conversation_summaries WHERE conversation_id = $1 LIMIT 1",
      [conversationId],
    );
    return rows[0];
  },

  async searchSummaries(
    query: string,
    limit = 5,
  ): Promise<SummarySearchResult[]> {
    const db = await getDb();
    const ftsQuery = normalizeFtsQuery(query);

    // Empty query: return most recent summaries
    if (!ftsQuery) {
      return db.select<SummarySearchResult[]>(
        `SELECT s.conversation_id, s.summary, s.keywords, 0.0 as rank,
                s.created_at
         FROM conversation_summaries s
         ORDER BY s.created_at DESC
         LIMIT $1`,
        [limit],
      );
    }

    // Try FTS5 first (fast, works for space-delimited languages)
    try {
      const ftsResults = await db.select<SummarySearchResult[]>(
        `SELECT f.conversation_id, f.summary, f.keywords, f.rank,
                s.created_at
         FROM conversation_summaries_fts f
         JOIN conversation_summaries s ON s.conversation_id = f.conversation_id
         WHERE conversation_summaries_fts MATCH $1
         ORDER BY f.rank
         LIMIT $2`,
        [ftsQuery, limit],
      );
      if (ftsResults.length > 0) return ftsResults;
    } catch {
      // FTS unavailable — fall through to LIKE
    }

    // Fallback: LIKE search (handles CJK and other non-space-delimited text)
    return likeFallbackSummaries(db, query, limit);
  },

  async searchMessages(
    query: string,
    conversationId?: string,
    limit = 20,
  ): Promise<{ conversation_id: string; message_id: string; body: string }[]> {
    const db = await getDb();

    // Try FTS5 first
    try {
      const ftsResults = await (conversationId
        ? db.select<{ conversation_id: string; message_id: string; body: string }[]>(
            `SELECT conversation_id, message_id, body
             FROM message_fts
             WHERE message_fts MATCH $1 AND conversation_id = $2
             ORDER BY rank
             LIMIT $3`,
            [query, conversationId, limit],
          )
        : db.select<{ conversation_id: string; message_id: string; body: string }[]>(
            `SELECT conversation_id, message_id, body
             FROM message_fts
             WHERE message_fts MATCH $1
             ORDER BY rank
             LIMIT $2`,
            [query, limit],
          ));
      if (ftsResults.length > 0) return ftsResults;
    } catch {
      // FTS unavailable — fall through to LIKE
    }

    // Fallback: LIKE search on messages table (handles CJK text)
    return likeFallbackMessages(db, query, conversationId, limit);
  },

  async deleteByConversation(conversationId: string): Promise<void> {
    const db = await getDb();
    // Clean FTS first, then base table
    await db.execute(
      "DELETE FROM conversation_summaries_fts WHERE conversation_id = $1",
      [conversationId],
    );
    await db.execute(
      "DELETE FROM conversation_summaries WHERE conversation_id = $1",
      [conversationId],
    );
  },
};
