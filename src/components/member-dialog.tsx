"use client";
import { useState } from "react";
import { Camera } from "lucide-react";
import { useStore } from "@/lib/store";
import { KELAS, type Kelas, type Member } from "@/lib/mock";
import { contractEndFor, contractKind, contractMonthsFor } from "@/lib/rules";
import { Avatar, Button, Dialog, Field, inputCls } from "./ui";

type Errors = Partial<Record<"name" | "noreg" | "kelas" | "joinDate" | "contractEnd" | "photo", string>>;

/** F-301/F-302: add or edit a member. `member` null = new. */
export function MemberDialog({ open, member, onClose }: { open: boolean; member: Member | null; onClose: () => void }) {
  const { s, today, saveMember, toast } = useStore();
  const blank: Member = {
    id: "", name: "", noreg: "", positionId: s.positions.find((p) => p.name === "Team Member")?.id ?? s.positions[0].id,
    statusId: s.empStatuses[0].id, kelas: "3A", joinDate: today, contractEnd: null, photoUrl: null, notes: "", active: true, deactivatedAt: null,
  };
  const [f, setF] = useState<Member>(member ?? blank);
  const [errors, setErrors] = useState<Errors>({});
  const [key, setKey] = useState(member?.id ?? "new");
  // reset form when a different member is opened
  if ((member?.id ?? "new") !== key) { setKey(member?.id ?? "new"); setF(member ?? blank); setErrors({}); }

  const status = s.empStatuses.find((e) => e.id === f.statusId);
  const hasContract = status?.hasContract ?? false;
  const isVokasi = status?.name === "Vokasi";
  const kindOf = (m: Member) => contractKind(
    s.empStatuses.find((e) => e.id === m.statusId)?.name ?? "",
    s.positions.find((p) => p.id === m.positionId)?.name ?? "",
  );
  const kind = kindOf(f);
  const months = contractMonthsFor(kind, s.settings.contractMonths);
  // status, position or join date changes recompute the contract end; manual edits stay possible afterwards
  const set = <K extends keyof Member>(k: K, v: Member[K]) => setF((x) => {
    const next = { ...x, [k]: v };
    if (k === "statusId" || k === "positionId" || k === "joinDate") next.contractEnd = contractEndFor(kindOf(next), next.joinDate, s.settings.contractMonths);
    return next;
  });

  function submit() {
    const e: Errors = {};
    if (!f.name.trim()) e.name = "Nama wajib diisi.";
    if (!f.noreg.trim()) e.noreg = "NoReg wajib diisi.";
    else if (s.members.some((m) => m.noreg.trim().toLowerCase() === f.noreg.trim().toLowerCase() && m.id !== f.id)) e.noreg = "NoReg tersebut sudah terdaftar.";
    if (!isVokasi && !f.kelas) e.kelas = "Pilih kelas member.";
    if (!f.joinDate) e.joinDate = "Join date wajib diisi.";
    if (hasContract && !f.contractEnd) e.contractEnd = "Akhir kontrak wajib untuk PKWT/Vokasi.";
    else if (hasContract && f.contractEnd && f.contractEnd < f.joinDate) e.contractEnd = "Akhir kontrak tidak boleh sebelum join date.";
    setErrors(e);
    if (Object.keys(e).length) return;
    const isNew = !f.id;
    saveMember({ ...f, id: f.id || `m${Date.now()}`, name: f.name.trim(), noreg: f.noreg.trim(), contractEnd: hasContract ? f.contractEnd : null, kelas: isVokasi ? null : f.kelas });
    toast(isNew ? "Member baru berhasil ditambahkan." : "Data member berhasil diperbarui.");
    onClose();
  }

  return (
    <Dialog open={open} onClose={onClose} title={member ? "Edit member" : "Tambah member"} wide
      footer={<><Button onClick={onClose}>Batal</Button><Button variant="primary" onClick={submit}>Simpan member</Button></>}>
      <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="grid gap-4 sm:grid-cols-2" noValidate>
        <div className="flex items-center gap-4 sm:col-span-2">
          <Avatar name={f.name || "?"} photoUrl={f.photoUrl} size={56} />
          <div>
            <label className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-md border border-line px-3 text-sm font-semibold hover:bg-soft">
              <Camera size={16} />{f.photoUrl ? "Ganti foto" : "Unggah foto"}
              <input type="file" accept="image/*" className="sr-only" onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                if (file.size > 2 * 1024 * 1024) return setErrors((x) => ({ ...x, photo: "Ukuran foto maksimal 2 MB." }));
                setErrors((x) => ({ ...x, photo: undefined }));
                set("photoUrl", URL.createObjectURL(file));
              }} />
            </label>
            <p className={errors.photo ? "mt-1 text-xs font-medium text-brand-strong" : "mt-1 text-xs text-muted"}>{errors.photo ?? "JPG/PNG, maksimal 2 MB."}</p>
          </div>
        </div>
        <Field label="Nama member *" error={errors.name}>
          <input className={inputCls} value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="Nama lengkap" autoComplete="off" />
        </Field>
        <Field label="NoReg *" error={errors.noreg}>
          <input className={inputCls} value={f.noreg} onChange={(e) => set("noreg", e.target.value)} placeholder="Nomor registrasi karyawan" inputMode="numeric" autoComplete="off" />
        </Field>
        <Field label="Posisi *">
          <select className={inputCls} value={f.positionId} onChange={(e) => set("positionId", e.target.value)}>
            {[...s.positions].sort((a, b) => a.order - b.order).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </Field>
        <Field label="Status karyawan *">
          <select className={inputCls} value={f.statusId} onChange={(e) => set("statusId", e.target.value)}>
            {s.empStatuses.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </Field>
        <Field label={isVokasi ? "Kelas" : "Kelas *"} error={errors.kelas} hint={isVokasi ? "Vokasi tidak memiliki kelas." : undefined}>
          <select className={inputCls} disabled={isVokasi} value={isVokasi ? "" : f.kelas ?? ""} onChange={(e) => set("kelas", (e.target.value || null) as Kelas | null)}>
            {isVokasi && <option value="">Tidak ada kelas</option>}
            {!isVokasi && !f.kelas && <option value="">Pilih kelas</option>}
            {KELAS.map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
        </Field>
        <Field label="Join date *" error={errors.joinDate}>
          <input type="date" className={inputCls} value={f.joinDate} onChange={(e) => set("joinDate", e.target.value)} />
        </Field>
        <Field label={hasContract ? "Akhir kontrak *" : "Akhir kontrak"} error={errors.contractEnd}
          hint={hasContract && months ? `Otomatis ${months} bulan dari join date (${kind === "vokasi" ? "Vokasi" : kind === "pkwt2" ? "PKWT 1 + perpanjangan PKWT 2" : "PKWT 1"}). Bisa diubah manual.` : "Karyawan tetap tidak memiliki masa kontrak."}>
          <input type="date" className={inputCls} disabled={!hasContract} value={hasContract ? f.contractEnd ?? "" : ""} onChange={(e) => set("contractEnd", e.target.value || null)} />
        </Field>
        <Field label="Catatan" className="sm:col-span-2">
          <textarea className={`${inputCls} min-h-20 py-2`} value={f.notes} onChange={(e) => set("notes", e.target.value)} />
        </Field>
      </form>
    </Dialog>
  );
}
