import * as z from 'zod';
import { Pool } from 'pg';

export const Access = z.enum(['Owner', 'Editor']);
export type Access = z.infer<typeof Access>;

export type User = {
  email: string;
  token: string;
};

export type Document = {
  id: string;
  title: string;
  access: { [email: string]: Access };
};

export class Database {
  private pool: Pool;

  private constructor(mongoUrl: string) {
    this.pool = new Pool({
      connectionString: mongoUrl,
    });
  }

  async init() {
    // TODO: Check db
    // const res = await this.pool.query(
    //   `SELECT * FROM pg_catalog.pg_tables WHERE schemaname != 'pg_catalog' AND schemaname != 'information_schema';`
    // );
    // console.log(res);
  }

  async findUserByToken(token: string): Promise<User | null> {
    const res = await this.pool.query<{ email: string; token: string }, [string]>(
      `SELECT * FROM users WHERE token=$1 LIMIT 1`,
      [token]
    );
    const first = res.rows[0];
    if (!first) {
      return null;
    }
    return first;
  }

  async findUserAccess(email: string, docId: string): Promise<Access | null> {
    console.log({ email, docId });
    throw new Error('TODO');
  }

  async findDocument(docId: string): Promise<Document> {
    console.log({ docId });
    throw new Error('TODO');
  }

  async updateDocument(
    docId: string,
    updates: { title: string; access: Record<string, 'Owner' | 'Editor'> }
  ): Promise<Document> {
    console.log({ updates, docId });
    throw new Error('TODO');
  }

  static async mount(mongoUrl: string): Promise<Database> {
    const db = new Database(mongoUrl);
    await db.init();
    return db;
  }
}
