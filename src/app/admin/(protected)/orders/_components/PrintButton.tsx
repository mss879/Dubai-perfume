"use client";

import { Printer } from "lucide-react";
import { Button } from "../../../_ui/Button";

/** Prints the packing slip laid out for paper (see the print-only block on the order page). */
export default function PrintButton({ label = "Print slip" }: { label?: string }) {
  return (
    <Button variant="secondary" onClick={() => window.print()} icon={<Printer className="h-4 w-4" aria-hidden />}>
      {label}
    </Button>
  );
}
