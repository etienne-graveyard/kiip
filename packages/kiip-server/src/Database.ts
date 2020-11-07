import * as z from 'zod';
import { Pool } from 'pg';
import { MerkleTreeRoot } from '@kiip/core';

export const Access = z.enum(['Owner', 'Editor']);
export type Access = z.infer<typeof Access>;

export type User = {
  email: string;
  token: string;
};

export type AccessObject = { [email: string]: Access };

export type Document = {
  id: string;
  title: string;
  access: AccessObject;
};

export class Database {
  private pool: Pool;

  private constructor(mongoUrl: string) {
    this.pool = new Pool({
      connectionString: mongoUrl,
    });
  }

  async init(): Promise<void> {
    console.log('TODO: Check db');
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

  async findUserByEmail(email: string): Promise<User | null> {
    const res = await this.pool.query<{ email: string; token: string }, [string]>(
      `SELECT * FROM users WHERE email=$1 LIMIT 1`,
      [email]
    );
    const first = res.rows[0];
    if (!first) {
      return null;
    }
    return first;
  }

  async insertUser(email: string, token: string): Promise<User> {
    const res = await this.pool.query<{ email: string; token: string }, [string, string]>(
      `INSERT INTO users(email, token) VALUES($1, $2) RETURNING *`,
      [email, token]
    );
    const first = res.rows[0];
    if (!first) {
      throw new Error('Unexpected db response');
    }
    return first;
  }

  async insertDocument(
    docId: string,
    title: string,
    owner: string,
    clock: string,
    tree: MerkleTreeRoot
  ): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      // insert doc
      await client.query<any, [string, string, string, string]>(
        'INSERT INTO documents(id, title, clock, merkle) VALUES($1, $2, $3, $4)',
        [docId, title, clock, JSON.stringify(tree)]
      );
      // set owner access
      await client.query<any, [string, string, Access]>(
        'INSERT INTO access(user_email, document_id, access) VALUES ($1, $2, $3)',
        [owner, docId, 'Owner']
      );
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  async findUserDocuments(token: string): Promise<User | null> {
    console.log({ token });
    throw new Error('TODO');
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
