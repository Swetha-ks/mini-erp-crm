import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { api } from "../api/client";

interface Customer {
  id: string;
  name: string;
  mobile: string;
  businessName?: string;
  customerType: string;
  status: string;
}

export function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [q, setQ] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);

  async function loadCustomers() {
    setLoading(true);
    const res = await api.get("/customers", { params: { q } });
    setCustomers(res.data.data);
    setLoading(false);
  }

  useEffect(() => {
    loadCustomers();
  }, []);

  function handleSearch(e: FormEvent) {
    e.preventDefault();
    loadCustomers();
  }

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1>Customers</h1>
        <button onClick={() => setShowForm(!showForm)}>{showForm ? "Cancel" : "+ Add Customer"}</button>
      </div>

      {showForm && <AddCustomerForm onCreated={() => { setShowForm(false); loadCustomers(); }} />}

      <form onSubmit={handleSearch} style={{ margin: "16px 0" }}>
        <input
          placeholder="Search by name or mobile..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ padding: 8, width: 300 }}
        />
        <button type="submit" style={{ marginLeft: 8 }}>Search</button>
      </form>

      {loading ? (
        <p>Loading...</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "2px solid #ccc" }}>
              <th>Name</th>
              <th>Mobile</th>
              <th>Type</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {customers.map((c) => (
              <tr key={c.id} style={{ borderBottom: "1px solid #eee" }}>
                <td>{c.name}</td>
                <td>{c.mobile}</td>
                <td>{c.customerType}</td>
                <td>{c.status}</td>
              </tr>
            ))}
            {customers.length === 0 && (
              <tr><td colSpan={4}>No customers found.</td></tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}

function AddCustomerForm({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [customerType, setCustomerType] = useState("RETAIL");
  const [error, setError] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await api.post("/customers", { name, mobile, customerType });
      onCreated();
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to create customer");
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ background: "#f9f9f9", padding: 16, marginTop: 12 }}>
      {error && <p style={{ color: "red" }}>{error}</p>}
      <input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} required style={{ marginRight: 8 }} />
      <input placeholder="Mobile" value={mobile} onChange={(e) => setMobile(e.target.value)} required style={{ marginRight: 8 }} />
      <select value={customerType} onChange={(e) => setCustomerType(e.target.value)} style={{ marginRight: 8 }}>
        <option value="RETAIL">Retail</option>
        <option value="WHOLESALE">Wholesale</option>
        <option value="DISTRIBUTOR">Distributor</option>
      </select>
      <button type="submit">Save</button>
    </form>
  );
}