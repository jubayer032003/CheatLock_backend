import { useEffect, useState } from "react";
import { Users } from "lucide-react";
import { fetchCommunity, updateCommunity } from "../lib/api";
import { Card, ErrorState, PageHeader } from "../components/ui";

export function CommunityPage() {
  const [students, setStudents] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchCommunity()
      .then((community) => setStudents(community.students.join(", ")))
      .catch(() => setMessage("Could not load community."));
  }, []);

  async function handleSave() {
    setSaving(true);
    setMessage("");
    try {
      const normalized = students
        .split(",")
        .map((student) => student.trim().toLowerCase())
        .filter(Boolean);
      const community = await updateCommunity(normalized);
      setStudents(community.students.join(", "));
      setMessage("Community saved.");
    } catch {
      setMessage("Could not save community.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Student management"
        title="Student Community"
        description="Maintain the default student group teachers can assign when creating exams with community enabled."
      />

      <Card className="p-5">
        <div className="flex items-start gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-md border border-cyan-300/30 bg-cyan-400/10 text-cyan-700 dark:text-cyan-200">
            <Users size={20} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-bold tracking-tight text-slate-950 dark:text-white">Community roster</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Separate students with commas. IDs are normalized before saving.</p>
          </div>
        </div>
        

        <label className="mt-5 block">
          <span className="field-label">Student emails or IDs</span>
          <textarea
            className="field-input min-h-44 py-3"
            value={students}
            onChange={(event) => setStudents(event.target.value)}
            placeholder="student.id@school.edu, cadet.id@school.edu"
          />
        </label>
        <button className="primary-button mt-4" disabled={saving} type="button" onClick={handleSave}>
          {saving ? "Saving..." : "Save Community"}
        </button>
      </Card>
//massage er code 
      {message && (
        message.includes("Could not")
          ? <ErrorState message={message} />
          : <Card className="p-4 text-sm font-medium text-emerald-700 dark:text-emerald-200">{message}</Card>
      )}
    </div>
  );
}
