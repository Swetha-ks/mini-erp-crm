import { useEffect, useState } from "react";
import { api } from "../api/client";

interface Challan {
  id: string;
  challanNumber: string;
  status: string;
  totalQuantity: number;
  customer: { name: string };
}

export function ChallansPage() {
  const [challans, setChallans] = useState<Challan[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  async function loadChallans() {
    setLoading(true);
    const res = await api.get("/challans");
    setChallans(res.data);
    setLoading(false);
  }

  useEffect(() => {
    loadChallans();
  }, []);

  async function handleConfirm(id: string) {
    try {
      await api.post(`/challans/${id}/confirm`);
      loadChallans();
    } catch (err: any) {
      alert(err.response?.data?.error || "Failed to confirm");
    }
  }

  async function handleCancel(id: string) {
    try {
      await api.post(`/challans/${id}/cancel`);
      loadChallans();
    } catch (err: any) {
      alert(err.response?.data?.error || "Failed to cancel");
    }
  }

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1>Sales Challans</h1>
        <button onClick={() => setShowForm(!showForm)}>{showForm ? "Cancel" : "+ New Challan"}</button>
      </div>

      {showForm && <NewChallanForm onCreated={() => { setShowForm(false); loadChallans(); }} />}

      {loading ? (
        <p>Loading...</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 16 }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "2px solid #ccc" }}>
              <th>Challan #</th>
              <th>Customer</th>
              <th>Qty</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {challans.map((c) => (
              <tr key={c.id} style={{ borderBottom: "1px solid #eee" }}>
                <td>{c.challanNumber}</td>
                <td>{c.customer.name}</td>
                <td>{c.totalQuantity}</td>
                <td>{c.status}</td>
                <td>
                  {c.status === "DRAFT" && (
                    <>
                      <button onClick={() => handleConfirm(c.id)} style={{ marginRight: 6 }}>Confirm</button>
                      <button onClick={() => handleCancel(c.id)}>Cancel</button>
                    </>
                  )}
                  {c.status === "CONFIRMED" && (
                    <button onClick={() => handleCancel(c.id)}>Cancel</button>
                  )}
                </td>
              </tr>
            ))}
            {challans.length === 0 && (
              <tr><td colSpan={5}>No challans found.</td></tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}

function NewChallanForm({ onCreated }: { onCreated: () => void }) {
  const [customers, setCustomers] = useState<{ id: string; name: string }[]>([]);
  const [products, setProducts] = useState<{ id: string; name: string; currentStock: number }[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [error, setError] = useState("");

  useEffect(() => {
    api.get("/customers", { params: { pageSize: 100 } }).then((res) => setCustomers(res.data.data));
    api.get("/products", { params: { pageSize: 100 } }).then((res) => setProducts(res.data.data));
  }, []);

  async function handleSubmit() {
    setError("");
    if (!customerId || !productId) return setError("Select a customer and a product");
    try {
      await api.post("/challans", {
        customerId,
        items: [{ productId, quantity: parseInt(quantity) }],
      });
      onCreated();
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to create challan");
    }
  }

  return (
    <div style={{ background: "#f9f9f9", padding: 16, marginTop: 12 }}>
      {error && <p style={{ color: "red" }}>{error}</p>}

      <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} style={{ marginRight: 8 }}>
        <option value="">Select customer...</option>
        {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>

      <select value={productId} onChange={(e) => setProductId(e.target.value)} style={{ marginRight: 8 }}>
        <option value="">Select product...</option>
        {products.map((p) => <option key={p.id} value={p.id}>{p.name} (Stock: {p.currentStock})</option>)}
      </select>

      <input
        type="number"
        min="1"
        value={quantity}
        onChange={(e) => setQuantity(e.target.value)}
        style={{ width: 60, marginRight: 8 }}
      />

      <button onClick={handleSubmit}>Save as Draft</button>
    </div>
  );
}