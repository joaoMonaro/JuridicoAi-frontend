import { Button } from "@/components/ui/button";
import { gerarPeticao } from "@/features/peticoes/api";
import { useState } from "react";

function App() {
  // Estados: o texto que o usuário digita, o resultado, carregando e erro
  const [fato, setFato] = useState("");
  const [peticao, setPeticao] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");

  async function handleGerar() {
    setErro("");
    setPeticao("");
    setCarregando(true);

    try {
      const texto = await gerarPeticao(fato);
      setPeticao(texto);
    } catch (e) {
      // Mostra a mensagem do erro que a camada de API lançou
      setErro(e instanceof Error ? e.message : "Algo deu errado.");
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="mx-auto max-w-3xl flex flex-col gap-4">
        <h1 className="text-2xl font-bold text-slate-800">Jurídico AI — Gerador de Petições</h1>

        <textarea
          className="w-full rounded-md border border-slate-300 p-3 text-sm"
          rows={4}
          placeholder="Descreva os fatos do caso..."
          value={fato}
          onChange={(e) => setFato(e.target.value)}
        />

        <Button onClick={handleGerar} disabled={carregando || !fato.trim()}>
          {carregando ? "Gerando..." : "Gerar petição"}
        </Button>

        {erro && <p className="text-sm text-red-600">⚠️ {erro}</p>}

        {peticao && (
          <div className="whitespace-pre-wrap rounded-md border border-slate-200 bg-white p-4 text-sm text-slate-800">
            {peticao}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
