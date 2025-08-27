"use client";
import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";

export default function BasicQuotePage() {
  const [tab, setTab] = useState("cotizador");

  return (
    <div>
      {/* Tabs navigation */}
      <nav>
        <button onClick={() => setTab("cotizador")}>Cotizador</button>
        <button onClick={() => setTab("otra")}>Otra herramienta</button>
      </nav>

      {/* Tabs content */}
      <div>
        {tab === "cotizador" && (
          <Card>
            <CardContent>
              <h2>Cotizador</h2>
              <p>Aquí irá el contenido del cotizador.</p>
            </CardContent>
          </Card>
        )}
        {tab === "otra" && (
          <Card>
            <CardContent>
              <h2>Otra herramienta</h2>
              <p>Contenido de otra herramienta</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
