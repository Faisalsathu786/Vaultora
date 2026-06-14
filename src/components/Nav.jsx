import { NAV } from '../constants/contracts.js';

export default function Nav({ page, setPage, isOwner }) {
  const navItems = NAV.filter(n => n.id !== 'admin' || isOwner);
  return (
    <nav className="nav">
      {navItems.map(n => (
        <button key={n.id} className={`nav-item ${page === n.id ? "active" : ""}`}
          onClick={() => setPage(n.id)}>
          {n.label}
        </button>
      ))}
    </nav>
  );
}
