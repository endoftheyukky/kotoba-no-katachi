/**
 * D1, as far as the functions use it, over node:sqlite and the repository's own
 * migrations. Each statement runs on its own turn of the event loop, after a
 * random short wait, so requests sent together interleave between statements
 * as they do on D1 (where one statement is atomic and a request is not).
 */
import { readdirSync, readFileSync } from 'node:fs'
import { DatabaseSync, type SQLInputValue } from 'node:sqlite'

const MIGRATIONS = new URL('../migrations/', import.meta.url)

export interface TestD1 extends D1Database {
  sqlite: DatabaseSync
  /** every statement run, in order */
  log: string[]
}

const turn = () => new Promise<void>((r) => setTimeout(r, Math.random() * 3))

export function testD1(): TestD1 {
  const sqlite = new DatabaseSync(':memory:')
  for (const f of readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort()) sqlite.exec(readFileSync(new URL(f, MIGRATIONS), 'utf8'))
  const log: string[] = []

  const statement = (sql: string, values: unknown[] = []): D1PreparedStatement & { exec(): D1Result } => {
    const exec = (): D1Result => {
      log.push(sql.replace(/\s+/g, ' ').trim())
      const s = sqlite.prepare(sql)
      const results = s.all(...(values as SQLInputValue[])) as Record<string, unknown>[]
      return { results, success: true, meta: {} }
    }
    return {
      bind: (...v: unknown[]) => statement(sql, v),
      first: async <T>() => {
        await turn()
        return (exec().results[0] as T) ?? null
      },
      all: async <T>() => {
        await turn()
        return exec() as D1Result<T>
      },
      run: async <T>() => {
        await turn()
        return exec() as D1Result<T>
      },
      exec,
    }
  }

  return {
    sqlite,
    log,
    prepare: (sql: string) => statement(sql),
    // a batch is one transaction, as on D1
    batch: async <T>(statements: D1PreparedStatement[]) => {
      await turn()
      sqlite.exec('BEGIN')
      try {
        const out = statements.map((s) => (s as ReturnType<typeof statement>).exec() as D1Result<T>)
        sqlite.exec('COMMIT')
        return out
      } catch (e) {
        sqlite.exec('ROLLBACK')
        throw e
      }
    },
  }
}
