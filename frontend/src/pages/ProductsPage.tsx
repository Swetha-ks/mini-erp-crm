import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { api } from "../api/client";

interface Product {
  id: string;
  name: string;
  sku: string;
  unitPrice: string;
  currentStock: number;
  minStockAlert: number;
}

export function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);

  async function loadProducts() {
    setLoading(true);
    const res = await api.get("/products");
    setProducts(res.data.data);
    setLoading(false);
  }

  useEffect(() => {
    loadProducts();
  }, []);

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1>Products</h1>
        <button onClick={() => setShowForm(!showForm)}>{showForm ? "Cancel" : "+ Add Product"}</button>
      </div>

      {showForm && <AddProductForm onCreated={() => { setShowForm(false); loadProducts(); }} />}

      {loading ? (
        <p>Loading...</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 16 }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "2px solid #ccc" }}>
              <th>Name</th>
              <th>SKU</th>
              <th>Price</th>
              <th>Stock</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr
                key={p.id}
                style={{
                  borderBottom: "1px solid #eee",
                  background: p.currentStock <= p.minStockAlert ? "#fff3cd" : "transparent",
                }}
              >
                <td>{p.name}</td>
                <td>{p.sku}</td>
                <td>₹{p.unitPrice}</td>
                <td>
                  {p.currentStock}
                  {p.currentStock <= p.minStockAlert && " ⚠️ Low"}
                </td>
              </tr>
            ))}
            {products.length === 0 && (
              <tr><td colSpan={4}>No products found.</td></tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}

function AddProductForm({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [currentStock, setCurrentStock] = useState("0");
  const [minStockAlert, setMinStockAlert] = useState("0");
  const [error, setError] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await api.post("/products", {
        name,
        sku,
        unitPrice: parseFloat(unitPrice),
        currentStock: parseInt(currentStock),
        minStockAlert: parseInt(minStockAlert),
      });
      onCreated();
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to create product");
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ background: "#f9f9f9", padding: 16, marginTop: 12 }}>
      {error && <p style={{ color: "red" }}>{error}</p>}
      <input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} required style={{ marginRight: 8 }} />
      <input placeholder="SKU" value={sku} onChange={(e) => setSku(e.target.value)} required style={{ marginRight: 8 }} />
      <input placeholder="Unit Price" type="number" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} required style={{ marginRight: 8, width: 100 }} />
      <input placeholder="Stock" type="number" value={currentStock} onChange={(e) => setCurrentStock(e.target.value)} style={{ marginRight: 8, width: 80 }} />
      <input placeholder="Min Alert" type="number" value={minStockAlert} onChange={(e) => setMinStockAlert(e.target.value)} style={{ marginRight: 8, width: 80 }} />
      <button type="submit">Save</button>
    </form>
  );
}