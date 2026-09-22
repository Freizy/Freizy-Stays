/** HTTP error with status — throw inside handlers/transactions, map to res in catch. */
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
  }
}
