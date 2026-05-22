import { trimAddr } from '../utils/format.js';

export default function Leaderboard({ leaderboard, wallet }) {
  return (
    <div className="pg">
      <div className="card">
        <div className="lb-top">
          <p className="card-lbl">Top Depositors</p>
          <div className="live-tag"><span className="live-dot" />Live</div>
        </div>
        {leaderboard.length === 0
          ? <p className="empty">No depositors yet</p>
          : leaderboard.map((u, i) => {
            const me = u.addr.toLowerCase() === wallet?.toLowerCase();
            return (
              <div key={i} className={`lb-row ${me ? "me" : ""}`}>
                <span className="lb-pos">{i === 0 ? "#1" : i === 1 ? "#2" : i === 2 ? "#3" : `#${i + 1}`}</span>
                <span className="lb-addr">{me ? "You" : trimAddr(u.addr)}</span>
                <span className="lb-val">{parseFloat(u.amount).toFixed(2)}</span>
              </div>
            );
          })
        }
      </div>
    </div>
  );
}
