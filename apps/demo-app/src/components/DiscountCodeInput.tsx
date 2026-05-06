"use client";

import { FormEvent, useState } from "react";

type DiscountState =
  | { status: "idle" }
  | { status: "success"; message: string }
  | { status: "error"; message: string };

export function DiscountCodeInput() {
  const [code, setCode] = useState("");
  const [discountState, setDiscountState] = useState<DiscountState>({
    status: "idle",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function applyDiscount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setDiscountState({ status: "idle" });

    const response = await fetch("/api/discount/apply", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ code }),
    });
    const result = (await response.json()) as {
      message?: string;
      error?: string;
    };

    if (response.ok) {
      setDiscountState({
        status: "success",
        message: result.message ?? "Discount applied.",
      });
    } else {
      setDiscountState({
        status: "error",
        message: result.error ?? "Discount code is invalid.",
      });
    }

    setIsSubmitting(false);
  }

  return (
    <form onSubmit={applyDiscount}>
      <label
        htmlFor="discount-code"
        style={{ display: "block", fontWeight: 600, marginBottom: "8px" }}
      >
        Discount code
      </label>
      <div style={{ display: "flex", gap: "8px" }}>
        <input
          id="discount-code"
          name="discount-code"
          onChange={(event) => setCode(event.target.value)}
          placeholder="SAVE10"
          style={{
            border: "1px solid #bcccdc",
            borderRadius: "6px",
            flex: 1,
            minWidth: 0,
            padding: "10px 12px",
          }}
          type="text"
          value={code}
        />
        <button
          disabled={isSubmitting}
          style={{
            background: "#0b6bcb",
            border: 0,
            borderRadius: "6px",
            color: "#ffffff",
            cursor: isSubmitting ? "not-allowed" : "pointer",
            fontWeight: 700,
            padding: "10px 14px",
          }}
          type="submit"
        >
          {isSubmitting ? "Applying" : "Apply"}
        </button>
      </div>
      {discountState.status !== "idle" ? (
        <p
          aria-live="polite"
          style={{
            color: discountState.status === "success" ? "#0f7b4f" : "#b42318",
            margin: "12px 0 0",
          }}
        >
          {discountState.message}
        </p>
      ) : null}
    </form>
  );
}
