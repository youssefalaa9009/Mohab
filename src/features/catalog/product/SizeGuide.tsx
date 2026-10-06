import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import type { SizeChart } from "../types";

export function SizeGuide({ chart }: { chart: SizeChart }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="link-underline label-caps text-muted hover:text-ink"
      >
        Size guide
      </button>
      <Modal
        open={open}
        onOpenChange={setOpen}
        title="Size guide"
        description={`${chart.name} · measurements in ${chart.unit === "cm" ? "centimetres" : "inches"}`}
        size="lg"
      >
        {/* Focusable, so keyboard users can scroll a wide chart. */}
        <div role="region" aria-label="Size chart" tabIndex={0} className="overflow-x-auto">
          <table className="w-full min-w-[24rem] border-collapse text-small tabular-nums">
            <caption className="sr-only">Garment measurements by size, in {chart.unit}</caption>
            <thead>
              <tr className="border-b border-ink">
                <th scope="col" className="py-3 pe-4 text-start label-caps">
                  Size
                </th>
                {chart.columns.map((column) => (
                  <th key={column} scope="col" className="py-3 pe-4 text-start label-caps">
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {chart.rows.map((row) => (
                <tr key={row.size} className="border-b border-line">
                  <th scope="row" className="py-3 pe-4 text-start font-medium">
                    {row.size}
                  </th>
                  {row.values.map((value, index) => (
                    <td key={chart.columns[index] ?? index} className="py-3 pe-4">
                      {value}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {chart.notes && <p className="mt-6 text-small text-muted">{chart.notes}</p>}
      </Modal>
    </>
  );
}
