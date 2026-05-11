export default function OfflineFallbackPage() {
  return (
    <main className="app-background auth-layout">
      <section className="auth-card" style={{ maxWidth: 560 }}>
        <p className="eyebrow">Modo sin conexion</p>
        <h1 className="hero-title" style={{ fontSize: "1.875rem" }}>Seguimos operando offline</h1>
        <p className="body-copy" style={{ marginTop: 0 }}>
          La red no esta disponible en este momento. Si ya habias iniciado sesion antes, vuelve a <strong>Inicio</strong> y la app usara los datos locales para continuar.
        </p>
        <p className="body-copy" style={{ marginTop: 0 }}>
          Si aun no iniciaste sesion, necesitas recuperar conectividad para autenticar tu cuenta.
        </p>
      </section>
    </main>
  );
}

