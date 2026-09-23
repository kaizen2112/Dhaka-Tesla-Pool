"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/field";
import { api } from "@/lib/api-client";
import { errorMessage } from "@/lib/errors";

// A driver who registered in the app has no Tesla yet (the seed gives Jashim his Bullet).
export function VehicleForm({ onCreated }: { onCreated: () => void }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError(null);
    try {
      await api.post("/vehicles", { name: String(form.get("name")), capacity: Number(form.get("capacity")) });
      onCreated();
    } catch (err) {
      setError(errorMessage(err));
      setPending(false);
    }
  }

  return (
    <Card title="Add your Tesla">
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <Input label="Name" name="name" placeholder="e.g. Bullet" maxLength={40} required />
        <Select label="Seats" name="capacity" defaultValue="3" hint="Fixed once set.">
          {[1, 2, 3, 4, 5, 6, 7].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </Select>
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        <Button type="submit" disabled={pending} className="self-start">
          {pending ? "Adding…" : "Add Tesla"}
        </Button>
      </form>
    </Card>
  );
}
