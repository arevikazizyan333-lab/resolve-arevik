// Not a TypeORM entity: canned responses are held in-memory by
// TicketsRepository (see its cannedResponses store) rather than persisted,
// since this v0 has no dedicated table for them.
export interface CannedResponse {
  id: string;
  title: string;
  body: string;
  createdAt: string;
}
