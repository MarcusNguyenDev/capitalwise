"use client";

import { Copy, MessageSquareText } from "lucide-react";
import { useState } from "react";

import { Button } from "@/shared/ui/button.component";
import { Dialog } from "@/shared/ui/dialog.component";
import { useToast } from "@/shared/ui/toast.provider";

/** The same decision in plain English, from a fixed template (no model involved), ready to read out or send. */
export function CustomerExplanationDialog({ customer_explanation }: { customer_explanation: string }) {
  const [is_open, setIsOpen] = useState(false);
  const { showToast } = useToast();

  const copyExplanation = () => {
    void navigator.clipboard
      ?.writeText(customer_explanation)
      .then(() => showToast({ title: "Explanation copied", tone: "success" }))
      .catch(() => undefined);
  };

  return (
    <>
      <Button icon={<MessageSquareText className="size-4" aria-hidden />} onClick={() => setIsOpen(true)}>
        Explain to customer
      </Button>
      <Dialog
        is_open={is_open}
        onOpenChange={setIsOpen}
        title="Explain to customer"
        description="Plain English you can read out or send. Written from a fixed template, not by the AI."
        footer={
          <>
            <Button onClick={() => setIsOpen(false)}>Close</Button>
            <Button variant="primary" icon={<Copy className="size-4" aria-hidden />} onClick={copyExplanation}>
              Copy text
            </Button>
          </>
        }
      >
        <p className="whitespace-pre-line rounded-md border-l-2 border-line-strong bg-canvas px-4 py-3 leading-relaxed">{customer_explanation}</p>
      </Dialog>
    </>
  );
}
