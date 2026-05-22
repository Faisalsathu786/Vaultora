import { NAV } from '../constants/contracts.js';

export default function Nav({ page, setPage }) {
  return (
    <nav className="nav">
      {NAV.map(n => (
        <button key={n.id} className={`nav-item ${page === n.id ? "active" : ""}`}
          onClick={() => setPage(n.id)}>
          {n.label}
        </button>
      ))}
    </nav>
  );
}
