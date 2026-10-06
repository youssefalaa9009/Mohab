import type { FastifyReply } from "fastify";

const BOM = String.fromCharCode(0xfeff);

/**
 * One CSV field: always quoted, and a leading = + - @ (or tab/CR) is prefixed
 * with ' so spreadsheets show it as text instead of running it as a formula.
 */
export function csvCell(value: string | number | null | undefined) {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replace(/^[=+\-@\t\r]/, "'$&").replace(/"/g, '""')}"`;
}

/** Send rows as a downloadable UTF-8 CSV that Excel opens with Arabic intact. */
export function sendCsv(
  reply: FastifyReply,
  filename: string,
  header: string[],
  rows: (string | number | null | undefined)[][],
) {
  const body = [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
  return (
    reply
      .header("content-type", "text/csv; charset=utf-8")
      .header("content-disposition", `attachment; filename="${filename}"`)
      // The byte-order mark tells Excel the file is UTF-8.
      .send(`${BOM}${body}`)
  );
}
