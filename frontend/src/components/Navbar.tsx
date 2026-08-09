import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  if (!user) return null;

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <nav style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: "12px 24px",
      background: "#1f2937",
      color: "white",
    }}>
      <div style={{ fontWeight: "bold" }}>Mini ERP + CRM</div>
      <div style={{ display: "flex", gap: 20 }}>
        <Link to="/customers" style={{ color: "white" }}>Customers</Link>
        <Link to="/products" style={{ color: "white" }}>Products</Link>
        <Link to="/challans" style={{ color: "white" }}>Challans</Link>
      </div>
      <div>
        <span style={{ marginRight: 12 }}>{user.name} ({user.role})</span>
        <button onClick={handleLogout}>Logout</button>
      </div>
    </nav>
  );
}