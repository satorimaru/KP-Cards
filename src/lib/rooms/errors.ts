export class RoomError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "RoomError";
    this.status = status;
  }
}

export function statusForError(error: unknown): { message: string; status: number } {
  if (error instanceof RoomError) {
    return { message: error.message, status: error.status };
  }
  if (error instanceof Error) {
    return { message: error.message, status: 400 };
  }
  return { message: "Request failed", status: 500 };
}
