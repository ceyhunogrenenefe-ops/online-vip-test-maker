"use client";

import { useParams } from "next/navigation";
import { SinavEkrani } from "@/components/deneme/SinavEkrani";

export default function SinavSayfasi() {
  const params = useParams<{ kod: string }>();
  return <SinavEkrani kod={params.kod} />;
}
