export interface SqlClient {
  query<Row>(text: string, params?: unknown[]): Promise<Row[]>;
  // Parameters aren't allowed here, which keeps the drivers' simple and extended protocols apart.
  execute(text: string): Promise<void>;
  transaction<T>(run: (tx: SqlClient) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}
