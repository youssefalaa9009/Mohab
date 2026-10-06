import { ErrorScene } from "./ErrorScene";

/** Any URL no route matches. The server answers it with a 404 status. */
export function NotFoundPage() {
  return <ErrorScene status={404} />;
}
