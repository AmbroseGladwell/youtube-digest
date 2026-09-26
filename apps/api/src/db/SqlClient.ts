export interface SqlClient {
  query<Row>(text: string, params?: unknown[]): Promise<Row[]>;
  // Several statements in one string, as a migration file is. Parameters are not allowed
  // there, which is what keeps the two drivers' simple and extended protocols apart.
  execute(text: string): Promise<void>;
  transaction<T>(run: (tx: SqlClient) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}
