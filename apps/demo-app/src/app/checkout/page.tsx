import { DiscountCodeInput } from "../../components/DiscountCodeInput";

export default function CheckoutPage() {
  return (
    <main
      style={{
        display: "grid",
        minHeight: "100vh",
        placeItems: "center",
        padding: "32px",
      }}
    >
      <section
        style={{
          width: "min(100%, 520px)",
          border: "1px solid #d9e2ec",
          borderRadius: "8px",
          background: "#ffffff",
          padding: "32px",
          boxShadow: "0 12px 32px rgba(23, 32, 42, 0.08)",
        }}
      >
        <h1 style={{ margin: "0 0 12px", fontSize: "2rem" }}>Checkout</h1>
        <p style={{ margin: "0 0 24px", color: "#52606d" }}>
          Apply a discount code before completing the demo purchase.
        </p>
        <DiscountCodeInput />
      </section>
    </main>
  );
}
