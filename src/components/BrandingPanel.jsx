import { useState } from 'react';
import { ethers } from 'ethers';

export default function BrandingPanel({ siteLogo, siteName, getSigner, PM_ADDRESS, PM_ABI, setSiteLogo, setSiteName, notify }) {
  const [saving, setSaving] = useState(false);
  const [logoVal, setLogoVal] = useState(siteLogo);
  const [nameVal, setNameVal] = useState(siteName);

  const saveBranding = async () => {
    try {
      setSaving(true);
      const signer = await getSigner();
      const pm = new ethers.Contract(PM_ADDRESS, PM_ABI, signer);
      await (await pm.setBranding(logoVal.trim(), nameVal.trim() || "Vaultora", "")).wait();
      setSiteLogo(logoVal.trim());
      setSiteName(nameVal.trim() || "Vaultora");
      notify("Branding saved onchain!", "success");
    } catch (e) {
      notify(e?.reason || "Save failed", "error");
    } finally { setSaving(false); }
  };

  return (
    <div className="logo-panel">
      <span className="fee-label">Site Branding (Onchain):</span>
      <p className="emerg-note">Saved on the blockchain and visible to all users.</p>
      <div className="logo-input-row" style={{ marginTop: 8 }}>
        <input className="num-input" style={{ flex: 1, marginBottom: 0 }}
          placeholder="Site name (e.g. Vaultora)" value={nameVal}
          onChange={e => setNameVal(e.target.value)} />
      </div>
      <div className="logo-input-row" style={{ marginTop: 8 }}>
        <input className="num-input" style={{ flex: 1, marginBottom: 0 }}
          placeholder="Logo URL (PNG, JPG, SVG)" value={logoVal}
          onChange={e => setLogoVal(e.target.value)} />
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 10, alignItems: "center" }}>
        <button className="resolve-confirm-btn" onClick={saveBranding} disabled={saving}>
          {saving ? <span className="spin" /> : "Save Onchain"}
        </button>
        {logoVal && (
          <button className="emerg-btn" style={{ padding: "6px 10px" }}
            onClick={() => { setLogoVal(""); }}>Remove Logo</button>
        )}
      </div>
      {logoVal && (
        <div className="logo-preview" style={{ marginTop: 10 }}>
          <img src={logoVal} alt="preview" onError={e => e.target.style.display="none"} />
        </div>
      )}
    </div>
  );
}
