import React, { useEffect, useState } from "react";
import { View } from "react-native";
import { SCHOOLS, type SchoolInfo } from "@freizy-stays/shared";
import { Chip } from "./ui";
import { api } from "../services/api";

/** School chips from the API (admin-managed), falling back to constants offline. */
export function SchoolPicker({ value, onChange, dark = false }: { value: string; onChange: (s: string) => void; dark?: boolean }) {
  const [names, setNames] = useState<string[]>([...SCHOOLS]);
  useEffect(() => {
    (async () => {
      try {
        const list = (await api.listSchools()) as SchoolInfo[];
        if (list.length) setNames(list.map((s) => s.name));
      } catch {
        /* offline: constants */
      }
    })();
  }, []);
  const shown = names.includes(value) ? names : [...names, value];
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
      {shown.map((s) => (
        <Chip key={s} label={s} on={value === s} dark={dark} onPress={() => onChange(s)} />
      ))}
    </View>
  );
}
