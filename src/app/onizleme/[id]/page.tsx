"use client";

import { useParams } from "next/navigation";
import { SinavEkrani } from "@/components/deneme/SinavEkrani";

export default function OnizlemeSayfasi() {
  const params = useParams<{ id: string }>();
  return <SinavEkrani onizlemeId={params.id} />;
}
