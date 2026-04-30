import { useEffect, useState } from "react";
import api from "../api";
import { Link } from "react-router-dom";
import { useAuth } from "../auth";
import { Loader2, Sparkles, Trash2, ArrowRight, Download } from "lucide-react";

const TYPES = [
  { id: "ebook", label: "Ebook" },
  { id: "course", label: "Course" },
  { id: "notion_template", label: "Notion Template" },
  { id: "prompt_pack", label: "Prompt Pack" },
  { id: "template", label: "Template Bundle" },
];

export default function Products() {
  const { refresh } = useAuth();
  const [items, setItems] = useState([]);
  const [niche, setNiche] = useState("");
  const [audience, setAudience] = useState("");
  const [productType, setProductType] = useState("ebook");
  const [priceHint, setPriceHint] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const load = async () => {
    const r = await api.get("/products");
    setItems(r.data);
  };
  useEffect(() => { load(); }, []);

  const generate = async (e) => {
    e.preventDefault();
    setErr("");
    if (!niche.trim()) { setErr("Niche required."); return; }
    setBusy(true);
    try {
      await api.post("/products/generate", {
        niche, audience, product_type: productType, price_hint: priceHint, extra_notes: notes,
      });
      setNiche(""); setAudience(""); setPriceHint(""); setNotes("");
      await Promise.all([load(), refresh()]);
    } catch (ex) {
      const detail = ex?.response?.data?.detail;
      if (detail?.code === "LIMIT_REACHED") setErr(detail.message);
      else setErr(typeof detail === "string" ? detail : "Generation failed.");
    } finally { setBusy(false); }
  };

  const del = async (id) => {
    if (!window.confirm("Delete this product and its campaigns/listings?")) return;
    await api.delete(`/products/${id}`);
    load();
  };

  const downloadAll = async () => {
    if (items.length === 0) return;
    const resp = await api.get("/products/download/all", { responseType: "blob" });
    const blob = new Blob([resp.data], { type: "application/zip" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "filthy-library.zip";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-8 lg:p-12" data-testid="products-page">
      <div className="flex items-end justify-between flex-wrap gap-4 mb-10">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-[#FFD600] mb-2">▮ Product forge</div>
          <h1 className="font-heading text-5xl lg:text-6xl uppercase">Generate digital products</h1>
        </div>
        {items.length > 0 && (
          <button
            onClick={downloadAll}
            className="border border-zinc-700 text-white font-mono text-xs uppercase tracking-widest px-5 py-3 hover:bg-white hover:text-black transition-colors flex items-center gap-2"
            data-testid="download-all-btn"
          >
            <Download className="w-4 h-4" /> Download all (.zip)
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-px bg-zinc-800 border border-zinc-800 mb-10">
        {/* Form */}
        <form onSubmit={generate} className="bg-zinc-950 p-6 lg:col-span-5">
          <div className="font-mono text-xs uppercase tracking-widest text-zinc-400 mb-6">▮ New product brief</div>

          <Field label="Niche *" value={niche} onChange={setNiche} placeholder="e.g. faceless youtube AI channels" testid="niche-input" />
          <Field label="Target audience" value={audience} onChange={setAudience} placeholder="optional — we'll pick" testid="audience-input" />

          <label className="block mb-4">
            <span className="block font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-400 mb-2">Product type</span>
            <select
              value={productType}
              onChange={(e) => setProductType(e.target.value)}
              className="w-full bg-transparent border border-zinc-800 px-4 py-3 text-white font-mono text-sm focus:border-[#FFD600] focus:outline-none"
              data-testid="type-select"
            >
              {TYPES.map((t) => (<option key={t.id} value={t.id} className="bg-zinc-950">{t.label}</option>))}
            </select>
          </label>

          <Field label="Price hint" value={priceHint} onChange={setPriceHint} placeholder="$27 sweet spot" testid="price-input" />
          <Field label="Notes" value={notes} onChange={setNotes} placeholder="optional flavor" testid="notes-input" />

          {err && (
            <div className="bg-[#FF3333]/10 border border-[#FF3333] text-[#FF3333] font-mono text-xs uppercase tracking-widest px-4 py-3 mb-4" data-testid="product-error">
              {err}
            </div>
          )}

          <button type="submit" disabled={busy} className="w-full bg-[#FFD600] text-black font-mono text-sm uppercase tracking-widest py-4 btn-hard disabled:opacity-60 flex items-center justify-center gap-2" data-testid="generate-product-btn">
            {busy ? (<><Loader2 className="w-4 h-4 animate-spin" /> Forging…</>) : (<><Sparkles className="w-4 h-4" /> Forge product</>)}
          </button>
        </form>

        {/* List */}
        <div className="bg-zinc-950 lg:col-span-7">
          <div className="px-6 py-4 border-b border-zinc-800 font-mono text-xs uppercase tracking-widest">▮ Your library — {items.length}</div>
          {items.length === 0 ? (
            <div className="p-10 text-center text-zinc-500 font-mono text-xs uppercase tracking-widest">No products yet. Forge one →</div>
          ) : (
            <div className="divide-y divide-zinc-800">
              {items.map((p) => (
                <div key={p.id} className="p-5 hover:bg-zinc-900 transition-colors" data-testid={`product-row-${p.id}`}>
                  <div className="flex items-start justify-between gap-4">
                    <Link to={`/app/products/${p.id}`} className="min-w-0 flex-1">
                      <div className="font-heading text-2xl uppercase truncate">{p.title}</div>
                      <div className="text-zinc-400 text-sm line-clamp-1">{p.tagline}</div>
                      <div className="flex gap-4 mt-2 font-mono text-[10px] text-zinc-500 uppercase tracking-widest">
                        <span>${p.price}</span>
                        <span className="text-[#FFD600]">{p.campaigns_count} campaigns</span>
                        <span className="text-[#FF3333]">{p.launched_stores.length} stores live</span>
                      </div>
                    </Link>
                    <div className="flex items-center gap-2">
                      <Link to={`/app/products/${p.id}`} className="p-2 text-zinc-400 hover:text-white" title="Open" data-testid={`open-${p.id}`}>
                        <ArrowRight className="w-4 h-4" />
                      </Link>
                      <button onClick={() => del(p.id)} className="p-2 text-zinc-400 hover:text-[#FF3333]" title="Delete" data-testid={`delete-${p.id}`}>
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, testid, ...rest }) {
  return (
    <label className="block mb-4">
      <span className="block font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-400 mb-2">{label}</span>
      <input
        {...rest}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        data-testid={testid}
        className="w-full bg-transparent border border-zinc-800 px-4 py-3 text-white font-mono text-sm focus:border-[#FFD600] focus:outline-none"
      />
    </label>
  );
}
