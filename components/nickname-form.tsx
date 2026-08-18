"use client";

import { useState } from "react";
import { updateNicknameAction } from "@/lib/auth/actions";

export default function NicknameForm({ nickname }: { nickname: string }) {
  const [value, setValue] = useState(nickname);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setLoading(true);

    const result = await updateNicknameAction(value);
    setLoading(false);

    if (result.error) {
      setError(result.error);
      return;
    }
    setSuccess(true);
  };

  return (
    <form onSubmit={submit}>
      <div className="field">
        <label>Nickname</label>
        <input
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setSuccess(false);
          }}
          required
        />
      </div>

      {error && (
        <div
          className="mono"
          style={{ color: "var(--magenta)", fontSize: 12, marginTop: 8 }}
        >
          {error}
        </div>
      )}
      {success && (
        <div
          className="mono"
          style={{ color: "var(--green)", fontSize: 12, marginTop: 8 }}
        >
          Nickname actualizado.
        </div>
      )}

      <button
        className="btn lg"
        type="submit"
        disabled={loading}
        style={{ width: "100%", marginTop: 8 }}
      >
        {loading ? "GUARDANDO..." : "GUARDAR NICKNAME"}
      </button>
    </form>
  );
}
